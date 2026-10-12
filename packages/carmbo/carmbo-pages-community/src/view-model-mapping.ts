import type {Community, NewCommunity} from './model.ts'
import type {CommunityView} from './view/model.ts'

// Converts UI strings to model types. Validation is left to the model schema.
export function viewToNewCommunity(view: CommunityView): NewCommunity {
  return {
    name: view.name,
    description: view.description.trim() === '' ? undefined : view.description,
  }
}

export function viewToCommunity(communityNumber: number, view: CommunityView): Community {
  return {communityNumber, ...viewToNewCommunity(view)}
}

export function communityToView(community: NewCommunity): CommunityView {
  return {
    name: community.name,
    description: community.description ?? '',
  }
}
