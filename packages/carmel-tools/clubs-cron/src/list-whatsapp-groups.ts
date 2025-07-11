import {createWhatsAppIntegrationService} from './create-club-service.ts'

const whatsappIntegrationService = createWhatsAppIntegrationService()

{
  const groups = await whatsappIntegrationService.fetchWhatsAppGroups()

  const groupInfos = groups.map((group) => ({id: group.id, name: group.name}))

  const groupsWithNames = groupInfos.filter((group) => group.name)

  for (const group of groupsWithNames) {
    console.log(`${group.name} ${group.id}`)
  }
}

console.log('\n\n********** Last groups with messages **********')

const groupsWithNames = Object.assign(
  await whatsappIntegrationService.fetchLastWhatsappGroupsThatWereReceivedMessage(),
  await whatsappIntegrationService.fetchLastWhatsappGroupsThatWereSentMessage(),
)

for (const [group, messages] of Object.entries(groupsWithNames)) {
  console.log('\n*********', group)
  console.log(
    messages
      .map((message) => '- ' + message.textMessage.replace('\n', '...').slice(0, 50))
      .join('\n'),
  )
}
