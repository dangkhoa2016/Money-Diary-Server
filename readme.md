
  
# Money Diary Server

A simple diary server made using [Fastify](https://github.com/fastify/fastify), current use Postgres as database service.

## Development

Please clone `.env.sample` file and to a new file, change env keys, example file name: `env.local`.
You need to make sure **private.key** and **public.key** are encrypted and set to for `jsonwebtoken` , example online tool [RSA Key Generator](https://cryptotools.net/rsagen) or [Online RSA Key Generator](https://travistidwell.com/jsencrypt/demo/)

--> To encrypt both ***.key** files, use the sample code below:
```
let privateKey = await fs.readFileSync(path.join(configFolder, 'private.key'), 'utf8');
let publicKey = await fs.readFileSync(path.join(configFolder, 'public.key'), 'utf8');
privateKey = await randomCrypto.encrypt(privateKey);
publicKey = await randomCrypto.encrypt(publicKey);
```

Then in terminal
run: `npm run start`
  
## Deploy
Deploy to your own server by using git.
