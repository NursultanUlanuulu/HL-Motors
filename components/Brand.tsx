'use client'

import { useLocale } from '@/components/LocaleProvider'

import Image from 'next/image'
import Link from 'next/link'

export function Brand({ admin = false }: { admin?: boolean }) {
	const { t } = useLocale()
	return (
		<Link
			className={`brand${admin ? ' admin-brand' : ''}`}
			href='/'
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
