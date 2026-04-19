export const EDITORIAL_CARD_CSS = `
  .editorial-card [data-reveal-index] .reveal {
    opacity: 0;
    transform: translateY(24px);
    transition:
      opacity 700ms cubic-bezier(0.22, 1, 0.36, 1),
      transform 700ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  .editorial-card [data-reveal-index][data-in-view="true"] .reveal {
    opacity: 1;
    transform: translateY(0);
  }
  .editorial-card [data-reveal-index][data-in-view="true"] .reveal-1 { transition-delay: 80ms; }
  .editorial-card [data-reveal-index][data-in-view="true"] .reveal-2 { transition-delay: 220ms; }
  .editorial-card [data-reveal-index][data-in-view="true"] .reveal-3 { transition-delay: 380ms; }

  .editorial-card .route-svg {
    transition: transform 400ms cubic-bezier(0.22, 1, 0.36, 1), filter 400ms ease;
  }
  .editorial-card a:hover .route-svg {
    transform: scale(1.03);
    filter:
      drop-shadow(0 0 14px color-mix(in srgb, var(--sport) 80%, transparent))
      drop-shadow(0 0 36px color-mix(in srgb, var(--sport) 60%, transparent));
  }
  .editorial-card a {
    transition: border-color 220ms ease, transform 220ms ease, box-shadow 220ms ease;
  }
  .editorial-card a:hover {
    border-color: color-mix(in srgb, var(--sport) 55%, #242424) !important;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6),
      0 0 0 1px color-mix(in srgb, var(--sport) 25%, transparent);
  }

  .editorial-card .hover-only {
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 240ms ease, transform 240ms ease;
  }
  .editorial-card a:hover .hover-only {
    opacity: 1;
    transform: translateY(0);
  }

  @media (prefers-reduced-motion: reduce) {
    .editorial-card [data-reveal-index] .reveal,
    .editorial-card [data-reveal-index][data-in-view="true"] .reveal {
      opacity: 1;
      transform: none;
      transition: none;
    }
    .editorial-card .route-svg { transition: none; }
    .editorial-card .hover-only { opacity: 1; transform: none; }
  }
`;
