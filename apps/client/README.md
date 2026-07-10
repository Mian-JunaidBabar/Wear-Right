# Wear Right — AI-Driven Clothing Recommendation System

A modern, tech-forward personal digital stylist web application designed to solve the phenomenon of online choice overload and reduce massive retail product return rates[cite: 1]. By leveraging computer vision and color theory, the system simulates real-time skin-tone detection to filter massive product catalogs down to a highly personalized collection, instantly generating complete cohesive outfits visualized on a calibrated virtual mannequin[cite: 1].

This repository contains the **30% static frontend prototype** engineered specifically for the **FYP1 7th-Semester Defense** workflow.

---

## 🚀 Core Features Implemented

The application is built around a single-page reactive architecture using modular React components[cite: 2] and tokenized CSS variables.

- **View 01: Interactive Landing Home Page**
  Establishes the platform's core retail problem statement, featuring high-impact visual typographic layouts, a business value metric banner, and a feature grid highlighting the system's core capabilities[cite: 1].
- **View 02: Onboarding & Authentication Interface**
  A split-screen credential layout featuring clean white form card containers for secure User Account Registration (FR_01) and User Authentication (FR_02) simulation[cite: 1].
- **View 03: Profile & Preference Wizard**
  A streamlined onboarding interface collecting user style preferences (FR_03) via visual interactive pill elements for Eastern, Western, Casual, and Formal fashion categories[cite: 1].
- **View 04: AI Face Scanning Viewport Simulator**
  A high-fidelity mockup simulating real-time video stream facial analysis (FR_04), crosshair overlays, and mock loading states that resolve into skin-tone classifications[cite: 1].
- **View 05: Curated Shop Dashboard (Smart Filtering)**
  Implements a strict design constraint displaying a curated catalog of exactly 10 to 15 matching items (FR_08) based on color-compatibility logic, preventing user decision fatigue[cite: 1].
- **View 06: Virtual Try-On & Automated Outfit Generator**
  A 50/50 split-screen environment showcasing complete generated outfits (FR_09, FR_10) on a avatar model[cite: 1, 2]. Features interactive controls for multi-angle previewing (FR_12) and body-size waist calibration (FR_11)[cite: 1].
- **View 07: Admin Panel Dashboard**
  An administrative interface satisfying inventory control parameters (FR_13), featuring summary metric cards and a dense metadata data table tracking item properties and style configurations (FR_14)[cite: 1].

---

## 🎨 Global Design Tokens & Aesthetic Identity

The application adheres to a minimal luxury fashion-tech design ecosystem. The entire theme is driven by unified CSS custom properties to ensure absolute visual consistency across both customer and administrative views[cite: 2]:

| Token Variable           | Theoretical Aesthetic Application                                                                       |
| :----------------------- | :------------------------------------------------------------------------------------------------------ |
| `--color-bg-canvas`      | **Alabaster Off-White** (`#FAFAFA`) used as the primary screen background canvas.                       |
| `--color-bg-surface`     | **Pure White** (`#FFFFFF`) used to elevate panels, content grids, and product cards.                    |
| `--color-text-primary`   | **Deep Obsidian Black** (`#111827`) dominating high-contrast structural typography and layout elements. |
| `--color-text-muted`     | **Muted Slate Gray** (`#4B5563`) for descriptions, product tags, and secondary metadata.                |
| `--color-accent-tech`    | **Cyber Electric Cyan** (`#0EA5E9`) for active interface paths, scanner crosshairs, and progress lines. |
| `--color-accent-success` | **Emerald Green** (`#10B981`) highlighting high AI matching scores and verification notifications.      |
| `--color-border`         | **Soft Gray** (`#E5E7EB`) defining subtle, sharp boundaries between grid elements.                      |

---

## 📦 Project Directory Layout

```text
├── src/
│   ├── components/
│   │   ├── Navigation.jsx       # Global persistent top/side route simulator
│   │   ├── HomeView.jsx         # View 01: Value proposition & feature grid
│   │   ├── AuthView.jsx         # View 02: Login and Registration layout card
│   │   ├── PreferenceView.jsx   # View 03: Interactive category & color swatches
│   │   ├── ScannerView.jsx      # View 04: LAB/HSV camera scanning simulation
│   │   ├── CatalogView.jsx      # View 05: Curated 10-15 item filtered shop grid
│   │   ├── TryOnView.jsx        # View 06: Visual mannequin & multi-angle layout
│   │   └── AdminView.jsx        # View 07: Product catalog and metadata configuration
│   ├── App.jsx                  # Application shell and UI state manager
│   ├── index.css                # Global Tailwind CSS and design token variables
│   └── main.jsx                 # Application entry mount point
├── package.json                 # Project execution metadata
└── README.md                    # System documentation
```
