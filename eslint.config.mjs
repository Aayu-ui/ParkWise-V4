import eslint from '@eslint/js';
import eslintReact from '@eslint-react/eslint-plugin';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.next/**',
      '.expo/**',
      'coverage/**',
      '.turbo/**',
      '.cache/**',
    ],
  },

  eslint.configs.recommended,

  ...tseslint.configs.recommended,

  {
    files: ['**/*.{js,mjs,cjs,jsx,ts,tsx}'],
    plugins: {
      '@eslint-react': eslintReact,
    },
    rules: {
      ...eslintReact.configs['recommended-type-checked'].rules,
    },
  },
);
