import * as exec from '@actions/exec'
import * as core from '@actions/core'

/**
 * Execute a git command and return the output
 */
async function execGit(
  repositoryPath: string,
  args: string[],
  silent: boolean = false
): Promise<string> {
  let output = ''
  let errorOutput = ''

  const options: exec.ExecOptions = {
    cwd: repositoryPath,
    silent: silent,
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString()
      },
      stderr: (data: Buffer) => {
        errorOutput += data.toString()
      }
    }
  }

  try {
    await exec.exec('git', args, options)
    return output.trim()
  } catch (error) {
    if (errorOutput) {
      core.debug(`Git command error: ${errorOutput}`)
    }
    throw error
  }
}

/**
 * Get tag annotation message using git command
 * @param repositoryPath Path to the repository
 * @param tag Tag name
 * @returns Tag annotation message or null if tag doesn't exist or isn't annotated
 */
export async function getTagAnnotation(repositoryPath: string, tag: string): Promise<string | null> {
  try {
    // Try to get annotated tag message
    // git tag -l -n999 <tag> will show the annotation if it exists
    const output = await execGit(repositoryPath, ['tag', '-l', '-n999', tag], true)
    
    if (!output) {
      // Tag doesn't exist
      return null
    }

    // Parse the output: format is "tag-name    annotation message"
    // If it's an annotated tag, it will have the message after the tag name
    // If it's a lightweight tag, it will just be the tag name
    const lines = output.split('\n')
    const firstLine = lines[0] || ''
    
    // Extract annotation message (everything after the tag name and whitespace)
    const match = firstLine.match(new RegExp(`^${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(.+)$`))
    
    if (match && match[1]) {
      return match[1].trim()
    }

    // Alternative: try git cat-file to get annotated tag object
    try {
      const catOutput = await execGit(
        repositoryPath,
        ['cat-file', '-p', `refs/tags/${tag}`],
        true
      )
      
      // Parse annotated tag format
      // Annotated tags have a format like:
      // object <sha>
      // type commit
      // tag <tag-name>
      // tagger <author> <date>
      // <blank line>
      // <annotation message>
      const catLines = catOutput.split('\n')
      let inMessage = false
      let messageLines: string[] = []
      
      for (const line of catLines) {
        if (inMessage) {
          messageLines.push(line)
        } else if (line.trim() === '') {
          // Empty line signals start of message
          inMessage = true
        }
      }
      
      if (messageLines.length > 0) {
        return messageLines.join('\n').trim()
      }
    } catch {
      // Not an annotated tag or error reading, fall through
    }

    // Lightweight tag - no annotation
    return null
  } catch (error) {
    core.debug(`Failed to get tag annotation for ${tag}: ${error}`)
    return null
  }
}

/**
 * Check if a tag exists
 */
export async function tagExists(repositoryPath: string, tag: string): Promise<boolean> {
  try {
    const output = await execGit(repositoryPath, ['tag', '-l', tag], true)
    return output.trim() === tag
  } catch {
    return false
  }
}

/**
 * Get the commit SHA that a tag points to
 */
export async function getTagCommit(repositoryPath: string, tag: string): Promise<string | null> {
  try {
    return await execGit(repositoryPath, ['rev-list', '-n', '1', tag], true)
  } catch {
    return null
  }
}

