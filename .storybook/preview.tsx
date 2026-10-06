import type { Preview } from '@storybook/nextjs'

import '../app/globals.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },
    nextjs: {
      // This repo uses the App Router only (no pages/ directory).
      appDirectory: true,
    },
  },
};

export default preview;