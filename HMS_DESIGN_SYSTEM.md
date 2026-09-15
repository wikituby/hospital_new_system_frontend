# Hospital Management System - Design System Guide

## Overview
This document outlines the design system and UI patterns used across all HMS modules. All modules follow consistent design principles based on modern hospital management systems.

## Design Principles

### 1. Color Scheme
- **Primary Blue**: `#3b82f6` - Used for primary actions, icons, and highlights
- **Success Green**: `#10b981` - Used for completed/positive states
- **Warning Orange**: `#f59e0b` - Used for pending/warning states
- **Danger Red**: `#ef4444` - Used for critical/error states
- **Neutral Grays**: `#64748b`, `#94a3b8` - Used for secondary text and borders

### 2. Typography
- **Page Titles**: 32px, font-weight 700
- **Section Titles**: 20px, font-weight 600
- **Body Text**: 14px, font-weight 400
- **Labels**: 14px, font-weight 500
- **Small Text**: 12px-13px

### 3. Spacing
- **Page Padding**: 24px
- **Card Padding**: 20px-24px
- **Element Gap**: 12px-16px
- **Section Margin**: 24px

### 4. Components

#### Statistics Cards
- Display key metrics with icons
- Border-left accent color based on status
- Hover effects for interactivity

#### Data Tables
- Clean, readable layout
- Hover states for rows
- Status badges for quick identification
- Action buttons in last column

#### Forms
- Clear labels with icons
- Focus states with blue border and shadow
- Required fields marked with red asterisk
- Grid layout for multiple fields

#### Buttons
- Primary: Blue background, white text
- Secondary: White background, gray border
- Success: Green background
- Danger: Red background
- Icon buttons: Square, 32px

## Module-Specific Patterns

### Clinical Modules (OPD, IPD, Laboratory)
- Patient queue/list on left
- Detailed form/view on right
- Real-time status updates
- Quick action buttons

### Administrative Modules (HR, Finance, Reports)
- Comprehensive data tables
- Advanced filtering
- Export functionality
- Summary statistics

### Support Modules (Pharmacy, Inventory)
- Stock levels and alerts
- Batch tracking
- Expiry date management
- Supplier information

## Dark Mode Support
All modules support dark mode with:
- Dark background: `#0f172a`
- Card background: `#1e293b`
- Border colors: `#334155`
- Text colors: `#e2e8f0`, `#cbd5e1`

## Responsive Design
- Mobile-first approach
- Grid layouts adapt to screen size
- Tables become cards on mobile
- Filters stack vertically

## Implementation Checklist

For each module, ensure:
- [ ] Page header with title and actions
- [ ] Statistics cards showing key metrics
- [ ] Search and filter functionality
- [ ] Data table or list view
- [ ] Form modals for add/edit
- [ ] Status badges and indicators
- [ ] Dark mode support
- [ ] Responsive layout
- [ ] Consistent spacing and typography

## Shared Stylesheet
Import `hms-shared-styles.css` for common components:
- `.hms-page` - Page container
- `.hms-stat-card` - Statistics cards
- `.hms-btn` - Buttons
- `.hms-table` - Data tables
- `.hms-form-*` - Form elements




















