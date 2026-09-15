import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { BioData } from '../interfaces/bio-data';


@Component({
  selector: 'app-formarrayexample',
  templateUrl: './formarrayexample.component.html',
  styleUrls: ['./formarrayexample.component.css']
})
export class FormarrayexampleComponent implements OnInit {
  myForm!: FormGroup;

  constructor(private formBuilder: FormBuilder) {}

  ngOnInit() {
    this.myForm = this.formBuilder.group({
      personalInfo: this.createPersonalInfoGroup(),
    });
  }

  createPersonalInfoGroup() {
    return this.formBuilder.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      age: ['', Validators.required],
      gender: ['', Validators.required],
  
      dependants: this.formBuilder.group({
        firstName: ['', Validators.required],
        lastName: ['', Validators.required],
        gender: ['', Validators.required]
      })
    });
  }
  
  submitBiodata() {
    if (this.myForm.valid) {
      const formData: BioData = {
        firstName: this.myForm.get('personalInfo.firstName')!.value,
        lastName: this.myForm.get('personalInfo.lastName')!.value,
        age: this.myForm.get('personalInfo.age')!.value,
        gender: this.myForm.get('personalInfo.gender')!.value,
        dependants: {
          firstName: this.myForm.get('personalInfo.dependants.firstName')!.value,
          lastName: this.myForm.get('personalInfo.dependants.lastName')!.value,
          gender: this.myForm.get('personalInfo.dependants.gender')!.value,
        }
      };
  
      console.log(formData);
    } else {
      // Handle form validation errors if needed
    }
  }
  
  


    }
