import type { Access, CollectionConfig, Where } from 'payload'
import { portalIdOf } from './lib/ids'

const master = ({ req }: { req: { user?: { role?: string } | null } }) => req.user?.role === 'master'

const masterOnly = { read: master, create: master, update: master, delete: master }

/** A signed-in person reads their own row; staff read their portal; the master reads all. */
function ownOrStaff(): Access {
  return ({ req }) => {
    const user = req.user as { id: number; role?: string; tenants?: { tenant?: unknown }[] } | null
    if (!user) return false
    const own: Where = { user: { equals: user.id } }
    if (user.role === 'master') return true
    if (user.role === 'learner') return own
    const portal = portalIdOf(user)
    if (!portal) return own
    return { or: [own, { portal: { equals: portal } }] }
  }
}

export const LegalPages: CollectionConfig = {
  slug: 'legal-pages',
  labels: { singular: 'Legal page', plural: 'Legal pages' },
  admin: {
    useAsTitle: 'title',
    description: 'Draft wording for adviser review. Publishing a new version asks people to agree again.',
  },
  access: {
    read: ({ req }) => (req.user?.role === 'master' ? true : { published: { equals: true } }),
    create: master,
    update: master,
    delete: master,
  },
  fields: [
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: [
        { label: 'Privacy notice', value: 'privacy' },
        { label: 'Terms of use', value: 'terms' },
        { label: 'Community guidelines', value: 'guidelines' },
        { label: 'Portal agreement', value: 'portal-agreement' },
      ],
    },
    { name: 'version', type: 'text', required: true, index: true },
    { name: 'title', type: 'text', required: true },
    { name: 'summary', type: 'textarea', required: true, admin: { description: 'One line learners see first. No legal words.' } },
    { name: 'body', type: 'textarea', required: true },
    { name: 'published', type: 'checkbox', defaultValue: false, index: true },
    {
      name: 'draftForAdviserReview',
      type: 'checkbox',
      defaultValue: true,
      label: 'Draft for adviser review',
      admin: { description: 'Keep this ticked until Leon’s adviser has signed off the wording.' },
    },
    { name: 'updatedLabel', type: 'text', admin: { description: 'The date shown on the page, such as 4 October 2026.' } },
  ],
}

export const Consents: CollectionConfig = {
  slug: 'consents',
  labels: { singular: 'Consent', plural: 'Consents' },
  admin: { description: 'A record that someone agreed to a named version, with the time.' },
  access: { read: ownOrStaff(), create: master, update: master, delete: master },
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: [
        { label: 'Privacy', value: 'privacy' },
        { label: 'Terms', value: 'terms' },
        { label: 'Guidelines', value: 'guidelines' },
        { label: 'Guardian', value: 'guardian' },
        { label: 'Email news', value: 'email-news' },
        { label: 'Portal agreement', value: 'portal-agreement' },
      ],
    },
    { name: 'version', type: 'text', required: true, index: true },
    { name: 'acceptedAt', type: 'date', required: true },
    { name: 'ipHash', type: 'text' },
    { name: 'byGuardian', type: 'checkbox', defaultValue: false },
    { name: 'guardianEmail', type: 'email' },
    { name: 'staffActor', type: 'relationship', relationTo: 'users' },
    { name: 'note', type: 'text' },
  ],
}

export const AgeProfiles: CollectionConfig = {
  slug: 'age-profiles',
  labels: { singular: 'Age profile', plural: 'Age profiles' },
  admin: { description: 'An age band only — never a date of birth. Used for children’s defaults and guardian consent.' },
  access: { read: ownOrStaff(), create: master, update: master, delete: master },
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, unique: true, index: true },
    {
      name: 'ageBand',
      type: 'select',
      required: true,
      options: [
        { label: 'Under 13', value: 'under-13' },
        { label: '13 to 17', value: '13-17' },
        { label: '18 or over', value: '18+' },
      ],
    },
    { name: 'guardianEmail', type: 'email' },
    { name: 'guardianTokenHash', type: 'text', access: { read: () => false } },
    { name: 'guardianTokenExpiresAt', type: 'date' },
    { name: 'waitingForGuardian', type: 'checkbox', defaultValue: false, index: true },
    { name: 'guardianAcceptedAt', type: 'date' },
    { name: 'schoolOfflineAt', type: 'date' },
    { name: 'schoolOfflineBy', type: 'relationship', relationTo: 'users' },
    { name: 'schoolOfflineNote', type: 'text' },
  ],
}

export const PortalContacts: CollectionConfig = {
  slug: 'portal-contacts',
  labels: { singular: 'Portal contacts', plural: 'Portal contacts' },
  admin: { useAsTitle: 'privacyName', description: 'Named privacy and safeguarding people for one portal. Lane C reads the safeguarding lead.' },
  access: {
    read: ({ req }) => {
      const user = req.user as { role?: string; tenants?: { tenant?: unknown }[] } | null
      if (!user) return false
      if (user.role === 'master') return true
      const portal = portalIdOf(user)
      return portal ? { portal: { equals: portal } } : false
    },
    create: master,
    update: master,
    delete: master,
  },
  fields: [
    { name: 'portal', type: 'relationship', relationTo: 'portals', required: true, unique: true, index: true },
    { name: 'privacyName', type: 'text' },
    { name: 'privacyEmail', type: 'email' },
    { name: 'safeguardingName', type: 'text' },
    { name: 'safeguardingEmail', type: 'email' },
    { name: 'safeguardingPhone', type: 'text' },
    {
      name: 'schoolOfflineConsent',
      type: 'checkbox',
      defaultValue: false,
      label: 'The school collects parental consent offline',
    },
    { name: 'agreementAcceptedAt', type: 'date' },
    { name: 'agreementName', type: 'text' },
    { name: 'agreementVersion', type: 'text' },
  ],
}

export const ChildCodeFlags: CollectionConfig = {
  slug: 'child-code-flags',
  labels: { singular: 'Child code flag', plural: 'Child code flags' },
  admin: { description: 'Marks an access code as for children, so the age step is pre-filled.' },
  access: masterOnly,
  fields: [
    { name: 'accessCode', type: 'relationship', relationTo: 'access-codes', required: true, unique: true, index: true },
    { name: 'forChildren', type: 'checkbox', defaultValue: true },
  ],
}

export const HelpRequests: CollectionConfig = {
  slug: 'help-requests',
  labels: { singular: 'Help request', plural: 'Help requests' },
  admin: { description: 'Something is not working, a learning question, or something worrying.' },
  access: { read: ownOrStaff(), create: master, update: master, delete: master },
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: [
        { label: 'Something is not working', value: 'broken' },
        { label: 'A question about my learning', value: 'learning' },
        { label: 'Something worrying', value: 'worrying' },
      ],
    },
    { name: 'page', type: 'text' },
    { name: 'device', type: 'text' },
    { name: 'note', type: 'textarea' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'open',
      options: [
        { label: 'Open', value: 'open' },
        { label: 'With a teacher', value: 'sent' },
        { label: 'Closed', value: 'closed' },
      ],
    },
    { name: 'happenedAt', type: 'date' },
  ],
}

export const consentCollections: CollectionConfig[] = [LegalPages, Consents, AgeProfiles, PortalContacts, ChildCodeFlags, HelpRequests]
