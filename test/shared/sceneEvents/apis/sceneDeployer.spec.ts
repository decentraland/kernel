import { expect } from "chai"
import { decodeBase64Files } from "shared/apis/SceneStateStorageController/SceneDeployer"

describe('Scene Deployer', () => {
    it('should decode base64 files', () => {

    const entityFiles: Map<string, Buffer> = new Map()
    const encodedFiles: Record<string,string> = {}

    const encodedString = Buffer.from("Hello", 'binary').toString('base64') 
    encodedFiles["test"] = encodedString
        // Decode those who need it
    decodeBase64Files(encodedFiles, entityFiles)

    expect(entityFiles.get("test").toString()).to.eql("Hello")  
    })
})