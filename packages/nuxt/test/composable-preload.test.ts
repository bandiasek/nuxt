import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import * as preloadComposable from '../src/app/composables/preload'
import * as useNuxtApp from '../src/app/nuxt'
import * as useRouter from '../src/app/composables/router'

const testComponentAsyncLoader = vi.fn().mockResolvedValue({ name: 'TestComponentContent_Loaded' })
const paramsComponents = ['TestComponent', 'NotImportedComponent']
const importedComponents = { TestComponent: { name: 'TestComponentContent', __asyncLoader: testComponentAsyncLoader, __asyncResolved: false } }

let useNuxtAppSpy: ReturnType<typeof vi.spyOn>

describe.skip('preload composable', () => {
  beforeAll(() => {
    useNuxtAppSpy = vi.spyOn(useNuxtApp, 'useNuxtApp').mockReturnValue({ vueApp: { _context: { components: importedComponents } } } as any)
  })

  afterAll(() => {
    vi.resetAllMocks()
  })

  describe('preloadComponents()', () => {
    it.skip('should not call any preload logic on server', async () => {
      // Arrange
      vi.stubGlobal('import', { meta: { server: true } })
      const spyLoadAsyncComponent = vi.spyOn(preloadComposable, '_loadAsyncComponent')

      // Act
      await preloadComposable.preloadComponents(['TestComponent'])

      // Assert
      expect(useNuxtAppSpy).not.toHaveBeenCalled()
      expect(spyLoadAsyncComponent).not.toHaveBeenCalled()
    })

    it('should call _loadAsyncComponent for each provided component (happy path)', async () => {
      // Act
      await preloadComposable.preloadComponents(paramsComponents)

      // Assert
      expect(useNuxtAppSpy).toHaveBeenCalled()
      expect(testComponentAsyncLoader).toHaveBeenCalledTimes(1)
    })

    it('should NOT call _loadAsyncComponent when component is not imported', async () => {
      // Arrange
      testComponentAsyncLoader.mockReset()

      // Act
      await preloadComposable.preloadComponents(['NotImportedComponent'])

      // Assert
      expect(useNuxtAppSpy).toHaveBeenCalled()
      expect(testComponentAsyncLoader).toHaveBeenCalledTimes(0)
    })
  })

  describe('prefetchComponents()', () => {
    it('should call preloadComponents with same parameters', async () => {
      // Arrange
      testComponentAsyncLoader.mockReset()

      // Act
      await preloadComposable.prefetchComponents(paramsComponents)

      // Assert
      expect(useNuxtAppSpy).toHaveBeenCalled()
      expect(testComponentAsyncLoader).toHaveBeenCalledTimes(1)
    })
  })

  describe('_loadAsyncComponent()', () => {
    const __asyncLoader = vi.fn().mockReturnValue('loaded')

    afterEach(() => {
      __asyncLoader.mockReset()
    })

    it('should call components async loader (happy path)', () => {
      // Arrange
      const component = { __asyncLoader, __asyncResolved: false }

      // Act
      const value = preloadComposable._loadAsyncComponent(component as any)

      // Assert
      expect(__asyncLoader).toHaveBeenCalled()
      expect(value).toBe('loaded')
    })

    it('should NOT call components async loader when already resolved', () => {
      // Arrange
      const component = { __asyncLoader, __asyncResolved: true }

      // Act
      const value = preloadComposable._loadAsyncComponent(component as any)

      // Assert
      expect(__asyncLoader).not.toHaveBeenCalled()
      expect(value).not.toBe('loaded')
    })

    it('should have checks in place, when component does not have async loaders', () => {
      // Arrange
      const component = { __asyncLoader: null, __asyncResolved: true }

      // Act
      const value = preloadComposable._loadAsyncComponent(component as any)

      // Assert
      expect(__asyncLoader).not.toHaveBeenCalled()
      expect(value).not.toBe('loaded')
    })
  })

  describe('preloadRouteComponents()', () => {
    const mockedComponent = vi.fn().mockResolvedValue({})

    const singleInvalidRouteMatched = [{ components: { default: undefined } }]
    const multipleRouteComponents = Array.from({ length: 5 }, () => ({ components: { default: mockedComponent } }))

    afterEach(() => {
      mockedComponent.mockReset()
    })

    it('should not preload routes if no matches were found', async () => {
      // Arrange
      const routerMock = {
        resolve: vi.fn().mockReturnValue({ path: '/test-path', matched: [] }),
      }
      vi.spyOn(useRouter, 'useRouter').mockReturnValue(routerMock as any)

      // Act
      await preloadComposable.preloadRouteComponents('/test-path', routerMock as any)

      // Assert
      expect(routerMock.resolve).toHaveBeenCalledWith('/test-path')
    })

    it('should not preload routes if route has been preloaded', async () => {
      // Arrange
      const routerMock = {
        resolve: vi.fn().mockReturnValue({ path: '/test-path', matched: [] }),
        _preloadPromises: ['/test-path'],
      }
      vi.spyOn(useRouter, 'useRouter').mockReturnValue(routerMock as any)

      // Act
      await preloadComposable.preloadRouteComponents('/test-path', routerMock as any)

      // Assert
      expect(routerMock.resolve).toHaveBeenCalledWith('/test-path')
    })

    it('should preload all components when route has multiple matched components', async () => {
      // Arrange
      const routerMock = {
        resolve: vi.fn().mockReturnValue({ path: '/test-path', matched: multipleRouteComponents }),
      }
      vi.spyOn(useRouter, 'useRouter').mockReturnValue(routerMock as any)

      // Act
      await preloadComposable.preloadRouteComponents('/test-path', routerMock as any)

      // Assert
      expect(routerMock.resolve).toHaveBeenCalledWith('/test-path')
      expect(mockedComponent).toHaveBeenCalledTimes(5)
    })

    it('should not preload component if the component is not loadable', async () => {
      // Arrange
      const routerMock = {
        resolve: vi.fn().mockReturnValue({ path: '/test-path', matched: singleInvalidRouteMatched }),
      }
      vi.spyOn(useRouter, 'useRouter').mockReturnValue(routerMock as any)

      // Act
      await preloadComposable.preloadRouteComponents('/test-path', routerMock as any)

      // Assert
      expect(routerMock.resolve).toHaveBeenCalledWith('/test-path')
      expect(mockedComponent).toHaveBeenCalledTimes(0)
    })
  })
})
