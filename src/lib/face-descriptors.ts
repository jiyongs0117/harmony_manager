const DB_NAME = 'harmony-face-cache'
const STORE_NAME = 'descriptors'
const DB_VERSION = 1

interface CachedEntry {
  memberId: string
  photoUrl: string
  descriptor: number[]
  createdAt: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'memberId' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function getCachedDescriptor(
  memberId: string,
  photoUrl: string
): Promise<Float32Array | null> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get(memberId)

      request.onsuccess = () => {
        const entry = request.result as CachedEntry | undefined
        if (entry && entry.photoUrl === photoUrl) {
          resolve(new Float32Array(entry.descriptor))
        } else {
          resolve(null)
        }
      }
      request.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export async function setCachedDescriptor(
  memberId: string,
  photoUrl: string,
  descriptor: Float32Array
): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const entry: CachedEntry = {
        memberId,
        photoUrl,
        descriptor: Array.from(descriptor),
        createdAt: Date.now(),
      }
      store.put(entry)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // IndexedDB not available (private browsing), silently ignore
  }
}

export async function clearDescriptorCache(): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // silently ignore
  }
}
