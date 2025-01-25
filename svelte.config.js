import adapter from '@sveltejs/adapter-auto';
import { sveltePreprocess } from 'svelte-preprocess'

export default {
  preprocess: sveltePreprocess(),
  kit: {
    adapter: adapter(),
  },
compilerOptions: {
  compatibility: {
    componentApi: 4, // to maintain compatibility with older Svelte APIs
  },
},
};