import React, {useEffect, useState} from 'react'
import {OgreGraph} from '@dotinc/ogre-react'
import {Repository, RepositoryObject} from '@dotinc/ogre'

interface DemoRepoProps {
}

interface someClass {
  name: string
  description: string
}

export const DemoRepo: React.FC<DemoRepoProps> = ({}) => {
  const [repository, setRepository] = useState<RepositoryObject<someClass> | undefined>(undefined)
  useEffect(() => {
    if (!repository) {
      setupRepo()
    }
  }, [])

  const setupRepo = async () => {
    let author = 'author <author@email.info>'
    const r = new Repository<someClass>({description: '', name: ''}, {})
    r.data.name = 'new name'
    r.data.description = 'first description'
    await r.commit('initial commit', author)

    r.checkout('description', true)
    r.data.description = 'some longer different description'
    await r.commit('change desc', author)

    r.data.description = 'correct mistake made in prev description'
    await r.commit('fix desc', author)

    r.createBranch('another_branch')

    r.data.description = 'yet another correction'
    await r.commit('typo fix', author)

    r.checkout('main')
    r.merge('description')

    setRepository(r)
  }

  return repository ? <OgreGraph repository={repository} /> : null
}
