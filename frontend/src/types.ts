export interface GenerateRequest {
  storyTitle: string
  acceptanceCriteria: string
  description?: string
  additionalInfo?: string
}

export interface JiraStory {
  id: string
  key: string
  storyTitle: string
  description?: string
  acceptanceCriteria?: string
  status?: string
}

export interface JiraConnectRequest {
  baseUrl: string
  email: string
  apiKey: string
  spaceName: string
}

export interface JiraConnectResponse {
  connected: boolean
  stories: JiraStory[]
}

export interface TestCase {
  id: string
  title: string
  steps: string[]
  testData?: string
  expectedResult: string
  category: string
}

export interface GenerateResponse {
  cases: TestCase[]
  model?: string
  promptTokens: number
  completionTokens: number
}

export interface FeatureFileRequest {
  storyTitle: string
  description?: string
  acceptanceCriteria?: string
  additionalInfo?: string
  cases: TestCase[]
}

export interface FeatureFileResponse {
  content: string
}