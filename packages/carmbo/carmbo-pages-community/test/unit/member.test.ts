import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {
  actionNames,
  availableActions,
  MemberStateSchema,
  RolesSchema,
  transitionMember,
  type MemberState,
} from '../../src/member-model.ts'
import {memberToView, viewToRoles} from '../../src/member-view-model-mapping.ts'
import {MemberRolesViewSchema, NewMemberViewSchema} from '../../src/view/member-model.ts'

const now = new Date('2026-10-28T10:00:00Z')
const roles = {
  poster: true,
  liveStreamer: false,
  moderator: true,
  userBlocker: false,
  userApprover: true,
}
const initial: MemberState = {
  ...roles,
  status: 'started-registration',
  enteredAt: new Date('2026-10-01T10:00:00Z'),
  entryOrder: '1',
  reasonCode: null,
  reasonText: null,
  registrationEmailSentAt: null,
}

describe('membership state and roles', () => {
  it('maps initial role choices without an expected history id', () => {
    const form = NewMemberViewSchema.parse({
      studentNumber: '2: Student',
      moderator: 'on',
      viewer: '',
    })
    assert.deepEqual(viewToRoles(form), {
      poster: false,
      liveStreamer: false,
      moderator: true,
      userBlocker: false,
      userApprover: false,
    })
    assert.equal('viewer' in form, false)
    assert.equal('expectedHistoryId' in form, false)
  })

  it('validates every status and requires matching reason and email data', () => {
    for (const status of [
      'requested-registration',
      'started-registration',
      'registered',
      'cancelled',
    ] as const) {
      assert.ok(MemberStateSchema.safeParse({...initial, status}).success)
      assert.equal(
        MemberStateSchema.safeParse({...initial, status, reasonCode: 'blocked'}).success,
        false,
      )
    }
    for (const reasonCode of ['self', 'removed', 'blocked', 'rejected'] as const) {
      assert.ok(
        MemberStateSchema.safeParse({...initial, status: 'unregistered', reasonCode}).success,
      )
    }
    for (const reasonCode of ['email-sending-failed', 'timeout'] as const) {
      assert.ok(
        MemberStateSchema.safeParse({
          ...initial,
          status: 'registration-failed',
          reasonCode,
          registrationEmailSentAt: now,
        }).success,
      )
    }
    assert.equal(MemberStateSchema.safeParse({...initial, status: 'unregistered'}).success, false)
    assert.equal(
      MemberStateSchema.safeParse({...initial, status: 'registration-failed'}).success,
      false,
    )
    assert.equal(
      MemberStateSchema.safeParse({...initial, status: 'registration-email-sent'}).success,
      false,
    )
    assert.equal(
      MemberStateSchema.safeParse({
        ...initial,
        status: 'registration-failed',
        reasonCode: 'timeout',
      }).success,
      false,
    )
    assert.equal(
      MemberStateSchema.safeParse({...initial, registrationEmailSentAt: now}).success,
      false,
    )
    assert.equal(
      MemberStateSchema.safeParse({
        ...initial,
        status: 'registration-email-sent',
        registrationEmailSentAt: new Date('2020-01-01'),
      }).success,
      false,
    )
    assert.equal(MemberStateSchema.safeParse({...initial, status: 'unknown'}).success, false)
    assert.equal(RolesSchema.safeParse({...roles, poster: 'on'}).success, false)
  })

  it('maps strings and makes viewer implicit rather than editable', () => {
    const form = MemberRolesViewSchema.parse({
      expectedHistoryId: crypto.randomUUID(),
      poster: 'on',
      userApprover: 'on',
      viewer: '',
    })
    assert.deepEqual(viewToRoles(form), {
      poster: true,
      liveStreamer: false,
      moderator: false,
      userBlocker: false,
      userApprover: true,
    })
    assert.equal('viewer' in form, false)
    const view = memberToView({
      ...initial,
      communityMemberNumber: 1,
      studentNumber: 2,
      name: 'Student',
      email: 'student@example.com',
      historyId: crypto.randomUUID(),
    })
    assert.equal(view.moderator, 'on')
    assert.equal(view.reasonCode, '')
    assert.equal(view.enteredAt, initial.enteredAt.toISOString())
  })
})

describe('membership transitions', () => {
  it('enforces the complete action matrix', () => {
    const cases: [MemberState['status'], MemberState['reasonCode'], string[]][] = [
      ['requested-registration', null, ['approve', 'reject', 'cancel', 'block']],
      ['started-registration', null, ['register', 'cancel', 'block']],
      ['registration-email-sent', null, ['register', 'cancel', 'block']],
      ['registration-failed', 'timeout', ['register', 'cancel', 'block']],
      ['registered', null, ['unregister-self', 'unregister-removed', 'block']],
      ['cancelled', null, ['re-add', 'block']],
      ['unregistered', 'self', ['re-add', 'block']],
      ['unregistered', 'removed', ['re-add', 'block']],
      ['unregistered', 'rejected', ['re-add', 'block']],
      ['unregistered', 'blocked', ['unblock-and-re-add']],
    ]
    for (const [status, reasonCode, actions] of cases) {
      const state = {
        ...initial,
        status,
        reasonCode,
        registrationEmailSentAt: ['registration-email-sent', 'registration-failed'].includes(status)
          ? now
          : null,
      }
      assert.deepEqual(availableActions(state), actions)
      for (const action of actionNames) {
        if (actions.includes(action)) {
          assert.ok(
            MemberStateSchema.safeParse(transitionMember(state, action, ' context ', now, '2'))
              .success,
          )
        } else {
          assert.throws(() => transitionMember(state, action, '', now, '2'))
        }
      }
    }
  })

  it('preserves roles on re-add/unblock, refreshes entry, and clears old attempt data', () => {
    for (const action of ['re-add', 'unblock-and-re-add'] as const) {
      const previous: MemberState = {
        ...initial,
        poster: false,
        status: 'unregistered',
        reasonCode: action === 're-add' ? 'removed' : 'blocked',
        reasonText: 'old error',
        registrationEmailSentAt: new Date('2026-10-02T10:00:00Z'),
      }
      const result = transitionMember(previous, action, '', now, '42')
      assert.deepEqual(result, {...initial, poster: false, enteredAt: now, entryOrder: '42'})
      assert.equal(previous.reasonText, 'old error')
    }
  })

  it('approval preserves entry order, and completion clears a failure reason', () => {
    assert.deepEqual(
      transitionMember({...initial, status: 'requested-registration'}, 'approve', '', now, '2'),
      initial,
    )
    const registered = transitionMember(
      {
        ...initial,
        status: 'registration-failed',
        reasonCode: 'email-sending-failed',
        reasonText: 'mail error',
      },
      'register',
      '',
      now,
      '2',
    )
    assert.equal(registered.reasonCode, null)
    assert.equal(registered.reasonText, null)
    assert.equal(registered.entryOrder, '1')
    assert.equal(registered.status, 'registered')
  })
})
