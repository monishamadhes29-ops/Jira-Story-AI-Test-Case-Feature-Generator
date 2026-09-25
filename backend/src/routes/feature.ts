import express from 'express'
import type { FeatureFileRequest } from '../schemas'
import { FeatureFileRequestSchema, FeatureFileResponseSchema } from '../schemas'

export const featureRouter = express.Router()

const inferPlaceholderName = (context: string, defaultName: string) => {
  const cleaned = context
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(-3)
    .join(' ')

  const normalized = cleaned
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')

  return normalized || defaultName
}

const normalizeStepText = (rawStep: string) => {
  let step = rawStep.trim()
  step = step.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
  step = step.replace(/\?/g, '')
  step = step.replace(/[.!]+$/g, '')
  step = step.replace(/^(Given|When|Then|And)\s+/i, '')
  step = step.replace(/^When the user\s+/i, 'the user ')
  step = step.replace(/^When user\s+/i, 'user ')
  step = step.replace(/^Does the UI\s+/i, 'the UI ')
  step = step.replace(/^Does the user\s+/i, 'the user ')
  step = step.replace(/^Is the user\s+/i, 'the user ')
  step = step.replace(/^Can the user\s+/i, 'the user can ')
  step = step.replace(/^Should the user\s+/i, 'the user should ')
  step = step.replace(/^Is the system\s+/i, 'the system ')
  step = step.replace(/^Does the system\s+/i, 'the system ')
  step = step.replace(/^Are the\s+/i, 'the ')
  step = step.replace(/^The user is able to\s+/i, 'the user can ')
  step = step.replace(/^The user clicks on\s+/i, 'the user clicks ')
  step = step.replace(/^The user clicks\s+/i, 'the user clicks ')
  return step.trim()
}

const classifyStep = (step: string) => {
  const normalized = step.toLowerCase()

  if (/^(is|does|can|should|are|was|were)\b/.test(normalized)) {
    return 'validation'
  }

  if (/\b(should|must|verify|validated|confirm|display|displays|show|shows|shown|appears|appear|present|visible|available|successful|successfully|error|failure|fail|cannot|can not|does not|doesn't|is not|isn't|has been|has|have|must be)\b/.test(normalized)) {
    return 'validation'
  }

  if (/\b(click|select|navigate|enter|type|submit|open|search|add|create|update|delete|change|choose|scroll|tap|sign in|login|log in|logout|log out|send|fill|press|selects|clicks|navigates|types|enters|opens|submits|chooses|adds|creates|updates|deletes|changes|fills|presses|searches|load|launch|clear|filter|sort|switch|expand|collapse|approve|reject|save|edit|view|access|authenticate)\b/.test(normalized)) {
    return 'action'
  }

  if (/\b(is on|is logged in|has access|has a|has an|exists|is available|is configured|is created|is set|is present|initially|given that|given|with valid|with invalid)\b/.test(normalized)) {
    return 'precondition'
  }

  return 'action'
}

const formatGherkinLine = (step: string, state: { given: boolean; when: boolean; then: boolean }) => {
  const normalized = normalizeStepText(step)
  const type = classifyStep(normalized)
  let prefix = 'And'

  if (type === 'precondition') {
    prefix = state.given ? 'And' : 'Given'
    state.given = true
  } else if (type === 'action') {
    prefix = state.when ? 'And' : 'When'
    state.when = true
  } else {
    prefix = state.then ? 'And' : 'Then'
    state.then = true
  }

  return `  ${prefix} ${normalized}`
}

const buildFeatureFileContent = (request: FeatureFileRequest) => {
  const title = request.storyTitle?.trim() || 'Feature'
  const lines: string[] = []

  lines.push(`Feature: ${title}`)

  if (request.description) {
    lines.push('')
    request.description.split('\n').forEach((line) => {
      const trimmed = line.trim()
      if (trimmed) lines.push(`  ${trimmed}`)
    })
  }

  if (request.acceptanceCriteria) {
    lines.push('')
    lines.push('  # Acceptance Criteria')
    request.acceptanceCriteria.split('\n').forEach((line) => {
      const trimmed = line.trim()
      if (trimmed) lines.push(`  # ${trimmed}`)
    })
  }

  request.cases.forEach((testCase) => {
    const scenarioTitle = testCase.title.trim() || testCase.id
    const steps = testCase.steps || []
    const placeholderNames: string[] = []
    const placeholderValues: string[] = []

    const preparedSteps = steps.map((step) => {
      const quotedRegex = /"([^\"]+)"/g
      let replacedStep = step
      let match: RegExpExecArray | null

      while ((match = quotedRegex.exec(step)) !== null) {
        const value = match[1]
        const contextStart = Math.max(0, match.index - 40)
        const context = step.slice(contextStart, match.index)
        const name = inferPlaceholderName(context, `Param${placeholderNames.length + 1}`)
        let uniqueName = name
        let collisionIndex = 1

        while (placeholderNames.includes(uniqueName)) {
          collisionIndex += 1
          uniqueName = `${name}${collisionIndex}`
        }

        placeholderNames.push(uniqueName)
        placeholderValues.push(value)
        replacedStep = replacedStep.replace(`"${value}"`, `"<${uniqueName}>"`)
      }

      return replacedStep
    })

    const state = { given: false, when: false, then: false }
    const outlineLines = preparedSteps.map((step) => formatGherkinLine(step, state))

    lines.push('')
    const scenarioLabel = placeholderNames.length ? 'Scenario Outline' : 'Scenario'
    lines.push(`${scenarioLabel}: ${scenarioTitle}`)
    lines.push(...outlineLines)

    if (placeholderNames.length) {
      lines.push('')
      lines.push('  Examples:')
      lines.push(`    | ${placeholderNames.join(' | ')} |`)
      lines.push(`    | ${placeholderValues.join(' | ')} |`)
    }
  })

  return lines.join('\n')
}

featureRouter.post('/', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const validationResult = FeatureFileRequestSchema.safeParse(req.body)

    if (!validationResult.success) {
      res.status(400).json({ error: `Validation error: ${validationResult.error.message}` })
      return
    }

    const content = buildFeatureFileContent(validationResult.data)

    const response = { content }
    const responseValidation = FeatureFileResponseSchema.safeParse(response)
    if (!responseValidation.success) {
      res.status(502).json({ error: 'Generated feature file response is invalid' })
      return
    }

    res.json(response)
  } catch (error) {
    console.error('Error in feature-file route:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
