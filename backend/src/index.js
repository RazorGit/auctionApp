const port = Number(process.env.PORT || 3000);
import { createApp } from "./app.js";

const app = createApp();

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on :${port}`);
});

