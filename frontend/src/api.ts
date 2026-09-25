import { FeatureFileRequest, FeatureFileResponse, GenerateRequest, GenerateResponse, JiraConnectRequest, JiraConnectResponse, JiraStory } from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081/api'

export async function generateTests(request: GenerateRequest): Promise<GenerateResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/generate-tests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    const data: GenerateResponse = await response.json()
    return data
  } catch (error) {
    console.error('Error generating tests:', error)
    throw error instanceof Error ? error : new Error('Unknown error occurred')
  }
}
export async function createFeatureFile(request: FeatureFileRequest): Promise<FeatureFileResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/feature-file`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    const data: FeatureFileResponse = await response.json()
    return data
  } catch (error) {
    console.error('Error creating feature file:', error)
    throw error instanceof Error ? error : new Error('Unknown error occurred')
  }
}
export async function verifyJiraConnection(): Promise<{ connected: boolean; message: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/jira/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return { connected: data.connected, message: data.message }
  } catch (error) {
    console.error('Error verifying Jira connection:', error)
    throw error instanceof Error ? error : new Error('Unknown error occurred')
  }
}
export async function fetchStoryFromJira(projectName: string, storyTitle: string): Promise<{ story: JiraStory }> {
  try {
    const response = await fetch(`${API_BASE_URL}/jira/fetch-story`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ projectName, storyTitle }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    const data: { story: JiraStory } = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching story from Jira:', error)
    throw error instanceof Error ? error : new Error('Unknown error occurred')
  }
}
export async function connectJira(request: JiraConnectRequest): Promise<JiraConnectResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/jira/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    const data: JiraConnectResponse = await response.json()
    return data
  } catch (error) {
    console.error('Error connecting Jira:', error)
    throw error instanceof Error ? error : new Error('Unknown error occurred')
  }
}