import {BrowserModule} from '@angular/platform-browser'
import {NgModule} from '@angular/core'
import {FormsModule} from '@angular/forms'
import {AppComponent} from './app.component'
import {PdfUploadComponent} from './pdf-upload/pdf-upload.component'
import {BrowserAnimationsModule} from '@angular/platform-browser/animations'
import {FlexLayoutModule} from '@angular/flex-layout'

@NgModule({
  declarations: [
    AppComponent,
    PdfUploadComponent,
  ],
  imports: [
    BrowserModule,
    FormsModule,
    BrowserAnimationsModule,
    FlexLayoutModule,
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {
}
