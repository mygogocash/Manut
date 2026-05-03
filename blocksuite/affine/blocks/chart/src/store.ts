import {
  type StoreExtensionContext,
  StoreExtensionProvider,
} from '@blocksuite/affine-ext-loader';
import { ChartBlockSchemaExtension } from '@blocksuite/affine-model';

export class ChartStoreExtension extends StoreExtensionProvider {
  override name = 'affine-chart-block';

  override setup(context: StoreExtensionContext) {
    super.setup(context);
    context.register(ChartBlockSchemaExtension);
  }
}
