import { WatchTenantCollection as WatchTenantCollection_1d0591e3cf4f332c83a86da13a0de59a } from '@payloadcms/plugin-multi-tenant/client'
import { TenantField as TenantField_1d0591e3cf4f332c83a86da13a0de59a } from '@payloadcms/plugin-multi-tenant/client'
import { AssignTenantFieldTrigger as AssignTenantFieldTrigger_1d0591e3cf4f332c83a86da13a0de59a } from '@payloadcms/plugin-multi-tenant/client'
import { ReadOnlyCreateView as ReadOnlyCreateView_f867db23544be3a803a925e2f4f86abd } from '../../../components/admin/read-only-create'
import { ViewAsAdminBanner as ViewAsAdminBanner_fc241803acf8cb0e2c7ee69899770228 } from '../../../components/viewas-admin-banner'
import { AppleAdminChrome as AppleAdminChrome_a6ddf8e3150d06372f411b2fb99c1b20 } from '../../../components/admin/apple-chrome'
import { AdminDashboardTitle as AdminDashboardTitle_582ccd566fc4f86dedcf8951c0a33aae } from '../../../components/admin/large-title'
import { AdminLoginTitle as AdminLoginTitle_582ccd566fc4f86dedcf8951c0a33aae } from '../../../components/admin/large-title'
import { TenantSelector as TenantSelector_d6d5f193a167989e2ee7d14202901e62 } from '@payloadcms/plugin-multi-tenant/rsc'
import { TenantSelectionProvider as TenantSelectionProvider_d6d5f193a167989e2ee7d14202901e62 } from '@payloadcms/plugin-multi-tenant/rsc'
import { CollectionCards as CollectionCards_f9c02e79a4aed9a3924487c0cd4cafb1 } from '@payloadcms/next/rsc'
import { S3ClientUploadHandler as S3ClientUploadHandler_f97aa6c64367fa259c5bc0567239ef24 } from '@payloadcms/storage-s3/client'

/** @type import('payload').ImportMap */
export const importMap = {
  "@payloadcms/plugin-multi-tenant/client#WatchTenantCollection": WatchTenantCollection_1d0591e3cf4f332c83a86da13a0de59a,
  "@payloadcms/plugin-multi-tenant/client#TenantField": TenantField_1d0591e3cf4f332c83a86da13a0de59a,
  "@payloadcms/plugin-multi-tenant/client#AssignTenantFieldTrigger": AssignTenantFieldTrigger_1d0591e3cf4f332c83a86da13a0de59a,
  "/components/admin/read-only-create#ReadOnlyCreateView": ReadOnlyCreateView_f867db23544be3a803a925e2f4f86abd,
  "/components/viewas-admin-banner#ViewAsAdminBanner": ViewAsAdminBanner_fc241803acf8cb0e2c7ee69899770228,
  "/components/admin/apple-chrome#AppleAdminChrome": AppleAdminChrome_a6ddf8e3150d06372f411b2fb99c1b20,
  "/components/admin/large-title#AdminDashboardTitle": AdminDashboardTitle_582ccd566fc4f86dedcf8951c0a33aae,
  "/components/admin/large-title#AdminLoginTitle": AdminLoginTitle_582ccd566fc4f86dedcf8951c0a33aae,
  "@payloadcms/plugin-multi-tenant/rsc#TenantSelector": TenantSelector_d6d5f193a167989e2ee7d14202901e62,
  "@payloadcms/plugin-multi-tenant/rsc#TenantSelectionProvider": TenantSelectionProvider_d6d5f193a167989e2ee7d14202901e62,
  "@payloadcms/next/rsc#CollectionCards": CollectionCards_f9c02e79a4aed9a3924487c0cd4cafb1,
  "@payloadcms/storage-s3/client#S3ClientUploadHandler": S3ClientUploadHandler_f97aa6c64367fa259c5bc0567239ef24
}
