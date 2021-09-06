import { PageRenderer } from './PageRenderer';

export default async function () {
  try {
    const pageRenderer = new PageRenderer();

    await pageRenderer.init();
    await pageRenderer.outputPages();
  } catch (error) {
    console.warn(error);
    throw error;
  }
}
