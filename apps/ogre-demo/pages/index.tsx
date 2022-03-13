import type {NextPage} from 'next'
import Head from 'next/head'
import styles from '../styles/Home.module.css'
import {LiveEditor, LiveError, LivePreview, LiveProvider} from 'react-live'
import * as polished from 'polished'
import {useEffect, useState} from 'react'
import {Repository} from '@dotinc/ogre'
import {OgreGraph} from '@dotinc/ogre-react'

const Home: NextPage = () => {
  const scope = {
    useState,
    useEffect,
    Repository,
    OgreGraph
  }
  return (
    <div className={styles.container}>
      <Head>
        <title>@dotinc/ogre-react demo</title>
        <meta name="description" content="@dotinc/ogre-react demo"/>
        <link rel="icon" href="/favicon.ico"/>
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Welcome to <a href="https://github.com/dotindustries/ogre">@dotinc/ogre</a>!
        </h1>

        <p className={styles.description}>
          Get started by{' '}
          <code className={styles.code}>npm i -S @dotinc/ogre @dotinc/ogre-react</code>
        </p>

        <LiveProvider code={code} scope={scope} language="tsx" style={{
          borderRadius: polished.rem(5),
          border: '1px solid #EEE5E5',
          boxShadow: '1px 1px 20px rgba(20, 20, 20, 0.27)',
          overflow: 'hidden',
          marginBottom: polished.rem(100)
        }}>
          <div id="liveWrapper" style={{
            display: 'flex',
            border: '1px solid #EEE5E5',
            borderRadius: polished.rem(5),
            flexDirection: 'row',
            justifyContent: 'stretch',
            alignItems: 'stretch'
          }}>
            <div id="styledEditor" style={{
              borderRadius: polished.rem(5),
              background: '#02091E',
              fontFamily: 'Source Code Pro, monospace',
              fontSize: polished.rem(14),
              height: polished.rem(700),
              maxHeight: polished.rem(700),
              overflow: 'auto',
              // column
              flexBasis: '50%',
              width: '50%',
              maxWidth: '50%'
            }}>
              <LiveEditor/>
            </div>
            <LivePreview style={{
              borderRadius: `${polished.rem(0)} ${polished.rem(5)} ${polished.rem(5)} ${polished.rem(0)}`,
              position: 'relative',
              padding: '0.5rem',
              background: '#EEE5E5',
              color: 'black',
              height: 'auto',
              overflow: 'hidden',
              textAlign: 'center',
              // column
              flexBasis: '50%',
              width: '50%',
              maxWidth: '50%'
            }}/>
          </div>
          <LiveError style={{
            display: 'block',
            padding: polished.rem(8),
            background: '#ee3b3b',
            color: '#efefef',
            whiteSpace: 'pre-wrap',
            textAlign: 'left',
            fontSize: '0.9em',
            fontFamily: 'Source Code Pro, monospace'
          }}/>
        </LiveProvider>
      </main>

    </div>
  )
}

export default Home

const code = `
() => {
  const [repository, setRepository] = useState(undefined)
  useEffect(() => {
    if (!repository) {
      setupRepo()
    }
    return () => setRepository(undefined)
  }, [])

  const setupRepo = async () => {
    let author = 'author <author@email.info>'
    const r = new Repository({description: '', name: ''}, {})
    r.data.name = 'new name'
    r.data.description = 'first description'
    await r.commit('initial commit', author)

    r.checkout('description', true)
    r.data.description = 'some longer different description'
    await r.commit('change desc', author)

    r.data.description = 'correct mistake made in prev description'
    await r.commit('fix desc', author)

    r.createBranch('feature')

    r.data.description = 'yet another correction'
    await r.commit('typo fix', author)

    r.checkout('main')
    r.merge('description')

    setRepository(r)
  }

  return repository ? <OgreGraph repository={repository} /> : null
}`
