import { exitQuietlyOnClosedPipe } from "./io";
import { main } from "./main";

exitQuietlyOnClosedPipe(process.stdout);

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(`azimuth crashed: ${(error as Error).stack ?? String(error)}\n`);
    process.exitCode = 3;
  },
);
