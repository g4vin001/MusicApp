'use client';

import { AudioLines, CircleHelp, NotebookPen, ScanLine, Search } from 'lucide-react';
import { usePathname } from 'next/navigation';

const navigation = [
  { href: '/', label: 'Creator studio', icon: ScanLine },
  { href: '/find', label: 'Find a song', icon: Search },
  { href: '/licenses', label: 'License notebook', icon: NotebookPen },
  { href: '/how-it-works', label: 'Help', icon: CircleHelp },
];

export function Brand() {
  return <a className="brand" href="/" aria-label="WhatSongIsThis? home"><span className="brand-mark"><AudioLines size={23} aria-hidden="true"/></span><span className="brand-word">what<span>song</span><span className="brand-question">?</span></span></a>;
}

export function Header() {
  const pathname = usePathname();
  return <><a className="skip-link" href="#main-content">Skip to content</a><header className="topbar"><Brand/><nav className="nav" aria-label="Main navigation">{navigation.map(link => <a key={link.href} href={link.href} aria-current={pathname === link.href ? 'page' : undefined}><link.icon size={16} aria-hidden="true"/>{link.label}</a>)}</nav></header></>;
}

export function Footer() {
  return <footer className="footer"><span>WhatSongIsThis? <span className="footer-description">Music review for creators.</span></span><nav className="footer-links" aria-label="Footer navigation"><a href="/for-creators">For creators</a><a href="/support">Support</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav></footer>;
}
