import { toolsProvider } from '@wix/app-tools/service-plugins';
import { runAriaTool } from '../../../../rental/aria';

toolsProvider.provideHandlers({
  runTool: async ({ request }) => {
    if (!request.methodName) throw new Error('methodName is required');
    const response = await runAriaTool(request.methodName, request.payload);
    return { response };
  },
});
