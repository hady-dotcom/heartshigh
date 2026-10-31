import config from '@payload-config'
import '@payloadcms/next/css'
import './admin-house.css'
import { APPLE_LOOK_BOOT } from '@/lib/apple-look'
import { RootLayout, handleServerFunctions } from '@payloadcms/next/layouts'
import { redirect } from 'next/navigation'
import type { ServerFunctionClient } from 'payload'
import React from 'react'
import { getSession } from '@/server/context'
import { importMap } from './admin/importMap.js'

type Args = { children: React.ReactNode }

const serverFunction: ServerFunctionClient = async function (args) {
  'use server'
  return handleServerFunctions({
    ...args,
    config,
    importMap,
  })
}

// Payload's layout throws a bare Forbidden (a 500 page) for signed-in people who are not the master.
const Layout = async ({ children }: Args) => {
  const { user } = await getSession()
  if (user && user.role !== 'master') redirect(`/?error=${encodeURIComponent('The data console is for the master desk. Your own desk is one tap away.')}`)
  return (
    <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
      <script dangerouslySetInnerHTML={{ __html: APPLE_LOOK_BOOT }} />
      {children}
    </RootLayout>
  )
}

export default Layout
