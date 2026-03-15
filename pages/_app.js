// pages/_app.js
import '../styles/globals.css'

export default function App({ Component, pageProps }) {
  return (
    <main className="dark">
      <Component {...pageProps} />
    </main>
  )
}
