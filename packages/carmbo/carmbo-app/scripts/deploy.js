#!/usr/bin/env node
import {readFileSync} from 'node:fs'
import {resolve, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {homedir} from 'node:os'
import {execFileSync} from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))

const projectName = process.argv[2]
const environmentName = process.argv[3]
const serviceName = process.argv[4]

if (!projectName || !serviceName || !environmentName) {
  console.error(
    'Usage: node scripts/deploy.js <projectName> <environmentName> <serviceName>',
  )
  process.exit(1)
}

const packageJson = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf8'))
const version = packageJson.version
const image = `giltayar/carmbo-app:${version}`

const railwayConfigPath = resolve(homedir(), '.railway', 'config.json')
const railwayConfig = JSON.parse(readFileSync(railwayConfigPath, 'utf8'))
const token = railwayConfig.user?.accessToken
if (!token) {
  console.error('No Railway access token found. Run `railway login` first.')
  process.exit(1)
}

const RAILWAY_API = 'https://backboard.railway.com/graphql/v2'

async function railwayQuery(query, variables) {
  const response = await fetch(RAILWAY_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({query, variables}),
  })
  const result = await response.json()
  if (result.errors) {
    console.error('Railway API error:', JSON.stringify(result.errors, null, 2))
    process.exit(1)
  }
  return result.data
}

// Find project by name (projects live under workspaces)
const workspacesData = await railwayQuery(`
  query {
    me {
      workspaces {
        id
        name
        projects {
          edges {
            node { id name }
          }
        }
      }
    }
  }
`)
const allProjects = workspacesData.me.workspaces.flatMap((ws) =>
  ws.projects.edges.map((e) => e.node),
)
const project = allProjects.find((p) => p.name === projectName)
if (!project) {
  console.error(
    `Project "${projectName}" not found. Available: ${allProjects.map((p) => p.name).join(', ')}`,
  )
  process.exit(1)
}

// Find service and environment by name within the project
const projectData = await railwayQuery(
  `query ($projectId: String!) {
    project(id: $projectId) {
      services { edges { node { id name } } }
      environments { edges { node { id name } } }
    }
  }`,
  {projectId: project.id},
)
const service = projectData.project.services.edges
  .map((e) => e.node)
  .find((s) => s.name === serviceName)
if (!service) {
  console.error(
    `Service "${serviceName}" not found. Available: ${projectData.project.services.edges.map((e) => e.node.name).join(', ')}`,
  )
  process.exit(1)
}
const environment = projectData.project.environments.edges
  .map((e) => e.node)
  .find((e) => e.name === environmentName)
if (!environment) {
  console.error(
    `Environment "${environmentName}" not found. Available: ${projectData.project.environments.edges.map((e) => e.node.name).join(', ')}`,
  )
  process.exit(1)
}

console.log(`Deploying ${image} to ${projectName}/${serviceName} (${environmentName})...`)

await railwayQuery(
  `mutation serviceInstanceUpdate($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
    serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
  }`,
  {
    serviceId: service.id,
    environmentId: environment.id,
    input: {source: {image}},
  },
)

console.log(`Image updated to ${image}, triggering redeploy...`)

execFileSync(
  'npx',
  ['railway', 'link', '-p', project.id, '-e', environmentName, '-s', serviceName],
  {stdio: 'inherit'},
)
execFileSync('pnpm', ['exec', 'railway', 'redeploy', '-y'], {stdio: 'inherit'})

console.log(`Successfully deployed ${image}`)
