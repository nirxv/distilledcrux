/* Payload's own chrome. These files are boilerplate from the framework and are
   not meant to be edited; the only change is the import path to our config. */
import type { ServerFunctionClient } from 'payload';
import config from '@payload-config';
import { RootLayout, handleServerFunctions } from '@payloadcms/next/layouts';
import { importMap } from './cms/importMap.js';
import '@payloadcms/next/css';
// Tailwind without preflight, scoped to .uui. See uui.css for why.
import './views/uui.css';
import React from 'react';

type Args = { children: React.ReactNode };

const serverFunction: ServerFunctionClient = async function (args) {
  'use server';
  return handleServerFunctions({ ...args, config, importMap });
};

export default function Layout({ children }: Args) {
  return (
    <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
      {children}
    </RootLayout>
  );
}
