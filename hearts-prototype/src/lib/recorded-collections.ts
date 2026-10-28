import { APIError, type CollectionConfig } from 'payload'

/** Rows the app writes itself. The create screen explains that instead of an Unauthorized error. */
export const RECORDED_COLLECTIONS = [
  'insight-events',
  'insight-sessions',
  'experiment-events',
  'experiment-assignments',
  'opening-answers',
  'view-as-sessions',
  'compass-attempts',
  'compass-serves',
  'compass-mixes',
  'heart-contributions',
  'audit-log',
] as const

const recorded = new Set<string>(RECORDED_COLLECTIONS)

export function withRecordedCreate(collection: CollectionConfig): CollectionConfig {
  if (!recorded.has(collection.slug)) return collection
  return {
    ...collection,
    access: { ...collection.access, create: () => true },
    admin: {
      ...collection.admin,
      components: {
        ...collection.admin?.components,
        views: {
          edit: {
            default: {
              Component: '/components/admin/read-only-create#ReadOnlyCreateView',
            },
          },
        },
      },
    },
    hooks: {
      ...collection.hooks,
      beforeChange: [
        ...(collection.hooks?.beforeChange || []),
        ({ data, operation, req }) => {
          if (operation === 'create' && req.payloadAPI !== 'local') {
            throw new APIError('These rows are recorded by the app. They are not added by hand.', 403)
          }
          return data
        },
      ],
    },
  }
}
