import { createIcons, icons } from 'lucide';

/**
 * Universal safe Lucide icon renderer
 */
export function renderIcons() {
  try {
    createIcons({ icons });
  } catch (err) {
    console.warn('Icon rendering warning:', err);
  }
}

window.renderIcons = renderIcons;
window.lucide = {
  createIcons: renderIcons
};
