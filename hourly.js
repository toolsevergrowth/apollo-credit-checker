import fetch from 'node-fetch';

async function loginToApollo(email, password) {
  const response = await fetch('https://app.apollo.io/api/v1/mixed_login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://app.apollo.io',
      'Referer': 'https://app.apollo.io/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36'
    },
    body: JSON.stringify({
      email,
      password,
      cacheKey: Date.now(),
      timezone_offset: -180
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Login failed with status ${response.status}: ${errText}`);
  }

  const setCookies = response.headers.getSetCookie?.() || response.headers.raw()['set-cookie'];
  const cookieHeader = Array.isArray(setCookies)
    ? setCookies.map(c => c.split(';')[0]).join('; ')
    : setCookies;

  const json = await response.json();
  console.log('✅ Logged into Apollo');

  return { cookieHeader, json };
}

const email = process.env.APOLLO_EMAIL;
const password = process.env.APOLLO_PASSWORD;

loginToApollo(email, password)
  .then(({ cookieHeader }) => {
    console.log('🔐 Apollo cookie:', cookieHeader);
  })
  .catch(err => {
    console.error('❌ Apollo login failed:', err.message);
    process.exit(1);
  });
