import { z } from 'zod'

export const GenerateRequestSchema = z.object({
  storyTitle: z.string().min(1, 'Story title is required'),
  acceptanceCriteria: z.string().min(1, 'Acceptance criteria is required'),
  description: z.string().optional(),
  additionalInfo: z.string().optional()
})

export const TestCaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  steps: z.array(z.string()),
  testData: z.string().optional(),
  expectedResult: z.string(),
  category: z.string()
})

export const GenerateResponseSchema = z.object({
  cases: z.array(TestCaseSchema),
  model: z.string().optional(),
  promptTokens: z.number(),
  completionTokens: z.number()
})

export const FeatureFileRequestSchema = z.object({
  storyTitle: z.string().optional(),
  description: z.string().optional(),
  acceptanceCriteria: z.string().optional(),
  additionalInfo: z.string().optional(),
  cases: z.array(TestCaseSchema).min(1, 'At least one test case is required')
})

export const FeatureFileResponseSchema = z.object({
  content: z.string()
})

export const JiraConnectRequestSchema = z.object({
  baseUrl: z.string().min(1, 'Base URL is required'),
  email: z.string().email('Valid email is required'),
  apiKey: z.string().min(1, 'Jira API key is required'),
  spaceName: z.string().min(1, 'Jira space/project name is required')
})

export const JiraStorySchema = z.object({
  id: z.string(),
  key: z.string(),
  storyTitle: z.string(),
  description: z.string().optional(),
  acceptanceCriteria: z.string().optional(),
  status: z.string().optional()
})

export const JiraConnectResponseSchema = z.object({
  connected: z.boolean(),
  stories: z.array(JiraStorySchema)
})

// Type exports
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>
export type TestCase = z.infer<typeof TestCaseSchema>
export type GenerateResponse = z.infer<typeof GenerateResponseSchema>
export type FeatureFileRequest = z.infer<typeof FeatureFileRequestSchema>
export type FeatureFileResponse = z.infer<typeof FeatureFileResponseSchema>
export type JiraConnectRequest = z.infer<typeof JiraConnectRequestSchema>
export type JiraStory = z.infer<typeof JiraStorySchema>
export type JiraConnectResponse = z.infer<typeof JiraConnectResponseSchema>