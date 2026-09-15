import { Injectable, inject } from '@angular/core';
import { Storage, getDownloadURL, ref, uploadBytesResumable } from '@angular/fire/storage';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Injectable({
  providedIn: 'root'
})
export class FileresourceService {
  private readonly storage: Storage = inject(Storage);
  title = 'test4';
  imgSrc: any = '/assets/imgplaceholder.jpg';
  selectedImg: any;
  filePath:string='';
  dataUrl:string="";

  constructor() { }

  async uploadFileMethod(directoryName: string, file: File): Promise<string> {
    try {
      // Create a StorageReference with the specified directory and file name
      const storageRef = ref(this.storage, `${directoryName}/${file.name}`);
      console.log(file);
  
      // Upload the file
      const uploadTask = uploadBytesResumable(storageRef, file);
  
      // Initialize a variable to store the download URL
      let downloadURL: string | null = null;

  
      // Create a promise that resolves when the upload is complete
      await new Promise<void>((resolve, reject) => {
        // Listen for state changes, errors, and completion of the upload
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            // Handle upload progress, if needed
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`Upload is ${progress}% complete`);
          },
          (error) => {
            // Handle upload error
            console.error('Upload error:', error);
            reject(error);
          },
          async () => {
            try {
              // Upload completed successfully, get the download URL
              downloadURL = await getDownloadURL(storageRef);
              

              //console.log('Upload successful! Download URL:', downloadURL);
              // You can use the downloadURL to store in your database or use it as needed
              resolve();
              sessionStorage.setItem('downloadUrl', downloadURL);
              //this.dataUrl = downloadURL;
              //console.log(sessionStorage.getItem('downloadURL'));



            } catch (error) {
              // Handle getting download URL error
              console.error('Error getting download URL:', error);
              reject(error);
            }

          }

        );
        
      });
  
      // Check if downloadURL is not null and return it
      if (downloadURL !== null) {
        return downloadURL;
        
      } else {
        throw new Error('Download URL is not available.');
      }
    } catch (error) {
      // Handle any errors that occur during the upload
      console.error('Error uploading file:', error);
      throw error; // Rethrow the error
    }
  }
  
  
}
