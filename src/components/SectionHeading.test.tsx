import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SectionHeading } from './SectionHeading'

describe('SectionHeading', () => {
  it('menampilkan eyebrow, judul, dan deskripsi', () => {
    render(<SectionHeading eyebrow="Visi" title="Judul Utama" description="Deskripsi singkat" />)

    expect(screen.getByText('Visi')).toBeInTheDocument()
    expect(screen.getByText('Judul Utama')).toBeInTheDocument()
    expect(screen.getByText('Deskripsi singkat')).toBeInTheDocument()
  })
})
