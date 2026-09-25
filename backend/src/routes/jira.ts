import express from 'express'
import { JiraConnectRequestSchema, JiraConnectResponseSchema } from '../schemas'

export const jiraRouter = express.Router()

const extractAfdText = (node: any): string => {
  if (!node) return ''
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(extractAfdText).filter(Boolean).join(' ')

  const text = typeof node.text === 'string' ? node.text : ''
  const children = Array.isArray(node.content) ? node.content.map(extractAfdText).filter(Boolean).join(' ') : ''
  return [text, children].filter(Boolean).join(' ')
}

const findAcceptanceCriteriaFieldId = async (baseUrl: string, credentials: string): Promise<string | undefined> => {
  try {
    const fieldResponse = await fetch(`${baseUrl}/rest/api/3/field`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: 'application/json'
      }
    })

    if (!fieldResponse.ok) return undefined

    const fields: any[] = await fieldResponse.json().catch(() => [])
    const matched = fields.find((field: any) => typeof field.name === 'string' && /acceptance\s*criteria/i.test(field.name))
    return matched?.id
  } catch {
    return undefined
  }
}

const findAcceptanceCriteriaField = (fields: any, fieldId?: string): string | undefined => {
  if (!fields || typeof fields !== 'object') return undefined

  const toStringValue = (value: any) => {
    if (typeof value === 'string') return value
    return extractAfdText(value)
  }

  if (fieldId && typeof fields[fieldId] !== 'undefined') {
    const value = fields[fieldId]
    const text = toStringValue(value).trim()
    if (text) return text
  }

  const isFieldKeyMatch = (key: string) => /acceptance\s*criteria/i.test(key)
  for (const key of Object.keys(fields)) {
    if (isFieldKeyMatch(key)) {
      const value = fields[key]
      const text = toStringValue(value).trim()
      if (text) return text
    }
  }

  for (const value of Object.values(fields)) {
    if (typeof value === 'string' && /acceptance\s*criteria/i.test(value)) {
      return value.trim()
    }
    const text = toStringValue(value).trim()
    if (text && /acceptance\s*criteria/i.test(text)) {
      return text
    }
  }

  return undefined
}

jiraRouter.post('/verify', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const baseUrl = process.env.JIRA_BASE_URL?.trim().replace(/\/+$/, '')
    const email = process.env.JIRA_EMAIL?.trim()
    const apiKey = process.env.JIRA_API_KEY?.trim()

    if (!baseUrl || !email || !apiKey) {
      res.status(400).json({
        error: 'Jira credentials not configured in environment variables. Please set JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_KEY in .env file.'
      })
      return
    }

    // Log for debugging (without exposing the full API key)
    console.log(`[Jira Verify] Connecting to: ${baseUrl}`)
    console.log(`[Jira Verify] Email: ${email}`)
    console.log(`[Jira Verify] API Key length: ${apiKey.length}`)

    const credentials = Buffer.from(`${email}:${apiKey}`).toString('base64')
    
    // Make a simple request to verify credentials work
    const verifyUrl = `${baseUrl}/rest/api/3/myself`
    console.log(`[Jira Verify] Making request to: ${verifyUrl}`)
    
    const verifyResponse = await fetch(verifyUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })

    console.log(`[Jira Verify] Response status: ${verifyResponse.status}`)

    if (!verifyResponse.ok) {
      const errorBody = await verifyResponse.text().catch(() => verifyResponse.statusText)
      console.error(`[Jira Verify] Error response: ${errorBody}`)
      res.status(verifyResponse.status).json({
        error: `Failed to connect to Jira: ${errorBody}. Please verify your JIRA_EMAIL and JIRA_API_KEY are correct.`
      })
      return
    }

    const userData: any = await verifyResponse.json().catch(() => null)
    
    res.json({
      connected: true,
      message: `Connected to Jira as ${userData?.displayName || userData?.emailAddress || 'user'}`,
      stories: []
    })
  } catch (error) {
    console.error('Error verifying Jira connection:', error)
    const isProd = process.env.NODE_ENV === 'production'
    res.status(500).json({
      error: isProd ? 'Internal server error' : (error instanceof Error ? error.message : String(error))
    })
  }
})

jiraRouter.post('/connect', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const validationResult = JiraConnectRequestSchema.safeParse(req.body)

    if (!validationResult.success) {
      res.status(400).json({
        error: `Validation error: ${validationResult.error.message}`
      })
      return
    }

    const { baseUrl, email, apiKey, spaceName } = validationResult.data
    const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '')
    const normalizedSpaceName = spaceName.trim()
    const escapedSpaceName = normalizedSpaceName.replace(/"/g, '\\"')
    const projectQuery = `"${escapedSpaceName}"`
    const jql = `project = ${projectQuery} AND issuetype = Story ORDER BY updated DESC`
    const searchUrl = `${normalizedBaseUrl}/rest/api/3/search/jql`
    const credentials = Buffer.from(`${email.trim()}:${apiKey.trim()}`).toString('base64')

    const jiraResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ jql, maxResults: 50, fields: ['*all'] })
    })

    if (!jiraResponse.ok) {
      const errorBody = await jiraResponse.text().catch(() => jiraResponse.statusText)
      res.status(jiraResponse.status).json({
        error: `Jira API error ${jiraResponse.status}: ${errorBody}`
      })
      return
    }

      let data: any = await jiraResponse.json().catch(() => null)
      if (!data || !Array.isArray(data.issues)) {
      res.status(502).json({
        error: 'Unexpected Jira response format'
      })
      return
    }

      let issues = data.issues
      if (issues.length === 0) {
        const projectSearchUrl = `${normalizedBaseUrl}/rest/api/3/project/search?query=${encodeURIComponent(normalizedSpaceName)}`
        const projectSearchResponse = await fetch(projectSearchUrl, {
          method: 'GET',
          headers: {
            Authorization: `Basic ${credentials}`,
            Accept: 'application/json'
          }
        })

        if (projectSearchResponse.ok) {
          const projectData: any = await projectSearchResponse.json().catch(() => null)
          const firstProjectKey = projectData?.values?.[0]?.key
          if (typeof firstProjectKey === 'string' && firstProjectKey.length > 0) {
            const fallbackJql = `project = "${firstProjectKey.replace(/"/g, '\\"')}" AND issuetype = Story ORDER BY updated DESC`
            const fallbackSearchUrl = `${normalizedBaseUrl}/rest/api/3/search/jql`
            const fallbackResponse = await fetch(fallbackSearchUrl, {
              method: 'POST',
              headers: {
                Authorization: `Basic ${credentials}`,
                Accept: 'application/json',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ jql: fallbackJql, maxResults: 50, fields: ['*all'] })
            })
            if (fallbackResponse.ok) {
              const fallbackData: any = await fallbackResponse.json().catch(() => null)
              if (fallbackData && Array.isArray(fallbackData.issues)) {
                issues = fallbackData.issues
              }
            }
          }
        }
      }
      data.issues = issues

      const acceptanceCriteriaFieldId = await findAcceptanceCriteriaFieldId(normalizedBaseUrl, credentials)
      const stories = data.issues.map((issue: any, idx: number) => {
      const fields = issue.fields || {}
      const descriptionField = fields.description
      // Robustly derive key and title with fallbacks to avoid validation errors
      const key = issue.key ?? issue.id ?? `UNKNOWN-${idx}`
      const summaryText = fields.summary ?? key
      const storyTitle = String(summaryText)
      let descriptionText = ''
      if (typeof descriptionField === 'string') {
        descriptionText = descriptionField
      } else if (descriptionField && typeof descriptionField === 'object' && Array.isArray(descriptionField.content)) {
        descriptionText = descriptionField.content
          .map((block: any) => {
            if (block.type === 'paragraph' && Array.isArray(block.content)) {
              return block.content.map((item: any) => item.text || '').join('')
            }
            return ''
          })
          .filter(Boolean)
          .join('\n')
      }

      const acceptanceCriteriaText = findAcceptanceCriteriaField(fields, acceptanceCriteriaFieldId)

      return {
        id: String(issue.id ?? key),
        key: String(key),
        storyTitle: storyTitle,
        description: descriptionText || undefined,
        acceptanceCriteria: acceptanceCriteriaText || undefined,
        status: fields.status?.name || 'Unknown'
      }
    })

    const finalResponse = JiraConnectResponseSchema.parse({
      connected: true,
      stories
    })

    res.json(finalResponse)
  } catch (error) {
    console.error('Error in Jira connect route:', error)
    // In development, return the error message to help debugging. In production, hide details.
    const isProd = process.env.NODE_ENV === 'production'
    res.status(500).json({
      error: isProd ? 'Internal server error' : (error instanceof Error ? error.message : String(error))
    })
  }
})

jiraRouter.post('/fetch-story', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { projectName, storyTitle } = req.body
    
    if (!projectName || !storyTitle) {
      res.status(400).json({ error: 'Project name and story title are required' })
      return
    }

    const baseUrl = process.env.JIRA_BASE_URL?.trim().replace(/\/+$/, '')
    const email = process.env.JIRA_EMAIL?.trim()
    const apiKey = process.env.JIRA_API_KEY?.trim()

    if (!baseUrl || !email || !apiKey) {
      res.status(400).json({ error: 'Jira credentials not configured in environment variables' })
      return
    }

    const credentials = Buffer.from(`${email}:${apiKey}`).toString('base64')
    
    // Search for story by project and summary text
    const summaryQuery = storyTitle.replace(/"/g, '\\"')
    const projectQuery = projectName.replace(/"/g, '\\"')
    const jql = `project = "${projectQuery}" AND summary ~ "${summaryQuery}" AND issuetype = Story ORDER BY updated DESC`
    const searchUrl = `${baseUrl}/rest/api/3/search/jql`

    const jiraResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ jql, maxResults: 10, fields: ['*all'] })
    })

    if (!jiraResponse.ok) {
      const errorBody = await jiraResponse.text().catch(() => jiraResponse.statusText)
      res.status(jiraResponse.status).json({
        error: `Jira API error ${jiraResponse.status}: ${errorBody}`
      })
      return
    }

    const data: any = await jiraResponse.json().catch(() => null)
    if (!data || !Array.isArray(data.issues)) {
      res.status(502).json({ error: 'Unexpected Jira response format' })
      return
    }

    if (data.issues.length === 0) {
      res.status(404).json({ error: `No story found with summary matching "${storyTitle}" in project "${projectName}"` })
      return
    }

    const issue = data.issues[0]
    const fields = issue.fields || {}
    const descriptionField = fields.description
    const key = issue.key ?? issue.id ?? 'UNKNOWN'
    const summaryText = fields.summary ?? key
    
    let descriptionText = ''
    if (typeof descriptionField === 'string') {
      descriptionText = descriptionField
    } else if (descriptionField && typeof descriptionField === 'object' && Array.isArray(descriptionField.content)) {
      descriptionText = descriptionField.content
        .map((block: any) => {
          if (block.type === 'paragraph' && Array.isArray(block.content)) {
            return block.content.map((item: any) => item.text || '').join('')
          }
          return ''
        })
        .filter(Boolean)
        .join('\n')
    }

    const acceptanceCriteriaFieldId = await findAcceptanceCriteriaFieldId(baseUrl, credentials)
    const acceptanceCriteriaText = findAcceptanceCriteriaField(fields, acceptanceCriteriaFieldId)

    const story = {
      id: String(issue.id ?? key),
      key: String(key),
      storyTitle: String(summaryText),
      description: descriptionText || undefined,
      acceptanceCriteria: acceptanceCriteriaText || undefined,
      status: fields.status?.name || 'Unknown'
    }

    res.json({ story })
  } catch (error) {
    console.error('Error in fetch-story route:', error)
    const isProd = process.env.NODE_ENV === 'production'
    res.status(500).json({
      error: isProd ? 'Internal server error' : (error instanceof Error ? error.message : String(error))
    })
  }
})
