'use client'

import { useLocale } from '@/components/LocaleProvider'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { MouseEvent } from 'react'

// Keep the sequence when the normal logo link navigates back to the home page.
let logoClickCount = 0
let logoSequenceStartedAt = 0

export function Brand({ admin = false }: { admin?: boolean }) {
	const { t } = useLocale()
	const router = useRouter()

	function handleLogoClick(event: MouseEvent<HTMLAnchorElement>) {
		if (admin || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.detail === 0) return
		const now = Date.now()
		if (now - logoSequenceStartedAt > 3000) {
			logoClickCount = 0
			logoSequenceStartedAt = now
		}
		logoClickCount += 1
		if (logoClickCount === 5) {
			event.preventDefault()
			logoClickCount = 0
			logoSequenceStartedAt = 0
			router.push('/login')
		}
	}
	return (
		<Link
			className={`brand${admin ? ' admin-brand' : ''}`}
			href='/'
			onClick={handleLogoClick}
			aria-label={t('Motors — на главную')}
		>
			<Image
				className='brand-logo'
				src='/motors-logo.png'
				width={1020}
				height={554}
				alt=''
				sizes='84px'
			/>
			<span className='brand-name'>Motors</span>
		</Link>
	)
}
