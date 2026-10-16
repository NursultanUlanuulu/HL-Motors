'use client';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { searchOptions, type SelectOption } from '@/lib/select-options';
import { useLocale } from './LocaleProvider';

export function SearchSelect({ label, value, options, placeholder, onChange, searchable = true, disabled = false, required = false }: {
  label: string; value: string; options: SelectOption[]; placeholder: string; onChange: (value: string) => void;
  searchable?: boolean; disabled?: boolean; required?: boolean;
}) {
  const { t } = useLocale(); const id = useId();
  const trigger = useRef<HTMLButtonElement>(null); const popup = useRef<HTMLDivElement>(null); const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false); const [query, setQuery] = useState(''); const [active, setActive] = useState(0);
  const choices = useMemo(() => [{ value: '', label: placeholder }, ...options], [options, placeholder]);
  const visible = useMemo(() => searchOptions(choices, query), [choices, query]);
  const selected = choices.find(option => option.value === value);
  const activeIndex = Math.min(active, Math.max(0, visible.length - 1));
  function position() {
    const button = trigger.current; const panel = popup.current; if (!button || !panel) return;
    const rect = button.getBoundingClientRect(); const viewport = window.visualViewport;
    const top = viewport?.offsetTop ?? 0; const height = viewport?.height ?? innerHeight; const width = viewport?.width ?? innerWidth;
    const below = top + height - rect.bottom - 12; const above = rect.top - top - 12;
    const upwards = below < 240 && above > below;
    const available = Math.max(140, Math.min(400, upwards ? above : below));
    const panelWidth = Math.min(Math.max(rect.width, 290), width - 24);
    Object.assign(panel.style, { width: `${panelWidth}px`, maxHeight: `${available}px`, left: `${Math.max(12, Math.min(rect.left, width - panelWidth - 12))}px`, top: upwards ? 'auto' : `${rect.bottom + 6}px`, bottom: upwards ? `${innerHeight - rect.top + 6}px` : 'auto' });
  }
  function close(focus = true) { popup.current?.hidePopover(); setOpen(false); if (focus) trigger.current?.focus(); }
  function show() {
    if (disabled) return;
    setQuery(''); setActive(Math.max(0, choices.findIndex(option => option.value === value)));
    popup.current?.showPopover(); position(); setOpen(true);
    requestAnimationFrame(() => { if (searchable) input.current?.focus(); else popup.current?.querySelector<HTMLElement>('[role="listbox"]')?.focus(); });
  }
  function choose(option: SelectOption) { onChange(option.value); close(); }
  function keys(event: KeyboardEvent) {
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      if ((event.key === 'Home' || event.key === 'End') && event.target === input.current && query) return;
      event.preventDefault();
      setActive(index => event.key === 'Home' ? 0 : event.key === 'End' ? Math.max(0, visible.length - 1) : Math.max(0, Math.min(visible.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
    } else if (event.key === 'Enter') { event.preventDefault(); if (visible[activeIndex]) choose(visible[activeIndex]); }
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    else if (event.key === 'Tab') close(false);
  }
  useEffect(() => {
    if (!open) return;
    const resize = () => position();
    // Scrolling a list should not move its anchored panel.
    const scroll = (event: Event) => { if (!(event.target instanceof Node) || !popup.current?.contains(event.target)) position(); };
    window.addEventListener('resize', resize); window.addEventListener('scroll', scroll, true);
    window.visualViewport?.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); window.removeEventListener('scroll', scroll, true); window.visualViewport?.removeEventListener('resize', resize); };
  }, [open]);
  useEffect(() => { if (open) document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' }); }, [activeIndex, open, id]);
  useEffect(() => { if (open) { setQuery(''); setActive(0); } }, [value]);
  return <div className="search-select">
    <span className="search-select-label" id={`${id}-label`}>{label}</span>
    <button ref={trigger} type="button" className="search-select-trigger" role="combobox" data-value={value} aria-label={label} aria-expanded={open} aria-controls={`${id}-list`} aria-haspopup="listbox" aria-required={required || undefined} disabled={disabled} onClick={() => open ? close() : show()} onKeyDown={event => { if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); show(); } }}><span className={value ? '' : 'search-select-placeholder'}>{selected?.label ?? value ?? placeholder}</span><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg></button>
    <div ref={popup} id={`${id}-popup`} popover="auto" className="search-select-popup" tabIndex={-1} onKeyDown={keys} onToggle={event => setOpen((event.nativeEvent as ToggleEvent).newState === 'open')}>
      {searchable && <div className="search-select-search"><input ref={input} type="search" value={query} placeholder={t('Введите название')} aria-label={`${t('Поиск')}: ${label}`} aria-controls={`${id}-list`} aria-activedescendant={visible[activeIndex] ? `${id}-option-${activeIndex}` : undefined} onChange={event => { setQuery(event.target.value); setActive(0); }} autoComplete="off" /><button type="button" onClick={() => close()} aria-label={t('Закрыть')}>×</button></div>}
      <div className="search-select-options" id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`} tabIndex={searchable ? undefined : 0} aria-activedescendant={!searchable && visible[activeIndex] ? `${id}-option-${activeIndex}` : undefined}>
        {visible.map((option, index) => <div key={option.value} id={`${id}-option-${index}`} role="option" data-value={option.value} aria-selected={option.value === value} className={`search-select-option ${index === activeIndex ? 'highlighted' : ''}`} onPointerMove={event => { if (event.pointerType === 'mouse') setActive(index); }} onMouseDown={event => event.preventDefault()} onClick={() => choose(option)}><span><b>{option.label}</b>{option.detail && option.detail !== option.label && <small>{option.detail}</small>}</span>{option.count !== undefined && <small className="search-select-count">{option.count}</small>}{option.value === value && <span className="search-select-check" aria-hidden="true">✓</span>}</div>)}
      </div>
      {!visible.length && <p className="search-select-empty" role="status">{t('Нет подходящих вариантов')}</p>}
      {searchable && <div className="search-select-hint">{t('Найдено вариантов: {count}', { count: visible.length })}</div>}
    </div>
  </div>;
}
