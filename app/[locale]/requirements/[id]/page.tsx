import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getSession, isSignedIn } from '@/lib/auth/session'
import RequirementDetailClient from './requirement-detail-client'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav')
  return { title: t('catalog') }
}

type Params = Promise<{ id: string }>

export default async function RequirementDetailPage({
  params,
}: {
  params: Params
}) {
  const { id } = await params
  const session = await getSession()
  return (
    <RequirementDetailClient
      currentActorName={isSignedIn(session) ? session.name : null}
      requirementId={id}
    />
  )
}
