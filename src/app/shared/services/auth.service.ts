import { Injectable, NgZone } from '@angular/core';
import { User } from './user';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import {
  AngularFirestore,
  AngularFirestoreDocument
} from '@angular/fire/compat/firestore';
import { Router } from '@angular/router';
import { GithubAuthProvider, GoogleAuthProvider } from '@angular/fire/auth';
import { ReplaySubject, take } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  userData: any; // Save logged in user data
  allUsers: ReplaySubject<any> = new ReplaySubject<any>();

  constructor(
    public afs: AngularFirestore, // Inject Firestore service
    public afAuth: AngularFireAuth, // Inject Firebase auth service
    public router: Router,
    public ngZone: NgZone // NgZone service to remove outside scope warning
  ) {
    /* Saving user data in localstorage when
     logged in and setting up null when logged out */
    this.afAuth.authState.subscribe((user) => {
      if (user) {
        console.log('now user: ', user);
        this.userData = user;
        localStorage.setItem('user', JSON.stringify(this.userData));
        JSON.parse(localStorage.getItem('user')!);
      } else {
        localStorage.setItem('user', 'null');
        JSON.parse(localStorage.getItem('user')!);
      }
    });

    // Get all accounts for statistics
    this.getAccounts();
  }

  // Sign in with email/password
  SignIn(email: string, password: string) {
    return this.afAuth
               .signInWithEmailAndPassword(email, password)
               .then((result) => {
                 this.ngZone.run(() => {
                   this.router.navigate(['dashboard']);
                 });
                 this.setUserData(result.user);
               })
               .catch((error) => {
                 window.alert(error.message);
               });
  }

  // Sign up with email/password
  SignUp(email: string, password: string) {
    return this.afAuth
               .createUserWithEmailAndPassword(email, password)
               .then((result) => {
                 /* Call the SendVerificationMail() function when new user sign
                  up and returns promise */
                 this.SendVerificationMail();
                 this.setUserData(result.user);
               })
               .catch((error) => {

                 const code = error.code;
                 const credential = error.credential;

                 console.log({error})
                 if (code === 'auth/email-already-in-use') {
                   // Get other Auth providers user has used before (e.g google.com)
                   this.afAuth.fetchSignInMethodsForEmail(email).then(result => {
                     console.log(result)
                     const provider = this.getAuthProvider(result[0]);
                     // Log in the user with other provider used before
                     this.authLogin(provider).then(result => {
                       this.afAuth.authState.pipe(take(1)).subscribe(user => {
                         if (user) {
                           user.linkWithCredential(credential).then(() => {
                             console.log('Credential linked successfully: ', credential);
                           });
                         }
                       });
                     });
                   });
                 }
               });
  }

  // Send email verification when new user sign up
  SendVerificationMail() {
    return this.afAuth.currentUser
               .then((u: any) => u.sendEmailVerification())
               .then(() => {
                 this.router.navigate(['verify-email-address']);
               });
  }

  // Reset Forgot password
  ForgotPassword(passwordResetEmail: string) {
    return this.afAuth
               .sendPasswordResetEmail(passwordResetEmail)
               .then(() => {
                 window.alert('Password reset email sent, check your inbox.');
               })
               .catch((error) => {
                 window.alert(error);
               });
  }

  // Returns true when user is logged in and email is verified
  get isLoggedIn(): boolean {
    const user = JSON.parse(localStorage.getItem('user')!);
    return user !== null && user.uid !== null;
  }

  getAuthProvider(provider: string) {
    if (provider === 'github.com') {
      return new GithubAuthProvider();
    } else {
      return new GoogleAuthProvider();
    }
  }

  // Sign in with Google
  GoogleAuth() {
    return this.authLogin(new GoogleAuthProvider()).then(() => {});
  }

  // Sign in with GitHub
  GithubAuth() {
    return this.authLogin(new GithubAuthProvider()).then(() => {});
  }

  // Auth logic to run auth providers
  authLogin(provider: any) {
    return this.afAuth
               .signInWithPopup(provider)
               .then((result) => {
                 this.setUserData(result.user).then(() => {
                   this.router.navigate(['dashboard']);
                 });
               })
               .catch(error => {

                 const code = error.code;
                 const credential = error.credential;

                 if (code === 'auth/account-exists-with-different-credential') {
                   // Get other Auth providers user has used before (e.g google.com)
                   this.afAuth.fetchSignInMethodsForEmail(error.email).then(result => {
                     const provider = this.getAuthProvider(result[0]);
                     // Log in the user with other provider used before
                     this.authLogin(provider).then(result => {
                       this.afAuth.authState.pipe(take(1)).subscribe(user => {
                         if (user) {
                           user.linkWithCredential(credential).then(() => {
                             console.log('Credential linked successfully: ', credential);
                           });
                         }
                       });
                     });
                   });
                 }

               });
  }


  /* Setting up user data when sign in with username/password,
   sign up with username/password and sign in with social auth
   provider in Firestore database using AngularFirestore + AngularFirestoreDocument service */
  setUserData(user: any) {
    const userRef: AngularFirestoreDocument<any> = this.afs.doc(
      `users/${user.uid}`
    );
    const userData: User = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      emailVerified: user.emailVerified,
      insertTime: new Date().toISOString(),
    };
    return userRef.set(userData, {
      merge: true
    });
  }

  // Sign out
  onSignOut() {
    return this.afAuth.signOut().then(() => {
      localStorage.removeItem('user');
      this.router.navigate(['sign-in']);
    });
  }

  onDeleteAccount() {
    let itemDoc = this.afs.doc<User>('users/' + this.userData.uid);
    itemDoc.delete().then(() => this.onSignOut());
    this.afAuth.currentUser.then(user => user?.delete());
  }

  getAccounts() {
    const collection = this.afs.collection('users').get();
    collection.subscribe(data => this.allUsers.next(data));
  }
}
