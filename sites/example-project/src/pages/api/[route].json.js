import {runQueries} from '@evidence-dev/db-orchestrator'
import { dev } from '$app/env';

export async function get({params}) {
  const { route } = params;
  const data = await runQueries(route, dev);
  console.log(`DB orchestrator returned => ${JSON.stringify(data)}`);
  return {
      body: {
        data
      }
  };
}