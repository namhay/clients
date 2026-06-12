'use client'
import Link from 'next/link'
import type { ComponentProps, MouseEvent } from 'react'
import { prefetchClientProfile } from '@/lib/list-cache'

type ClientLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
  clientId: string
  href?: string
}

/** Link to a client profile; prefetches profile data on hover. */
export default function ClientLink({
  clientId,
  href,
  onMouseEnter,
  children,
  ...props
}: ClientLinkProps) {
  const handleMouseEnter = (e: MouseEvent<HTMLAnchorElement>) => {
    void prefetchClientProfile(clientId)
    onMouseEnter?.(e)
  }

  return (
    <Link
      href={href ?? `/clients/${clientId}`}
      prefetch
      onMouseEnter={handleMouseEnter}
      {...props}
    >
      {children}
    </Link>
  )
}
