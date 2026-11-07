const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const renter=fs.readFileSync(path.join(root,"assets/gdr-rental-suite-v2.js"),"utf8");
const owner=fs.readFileSync(path.join(root,"assets/gdr-owner-payments.js"),"utf8");
test("Renter payment uses owner UPI details and app-specific UPI deep links",()=>{
 for(const token of ["tez://upi/pay?","phonepe://pay?","paytmmp://pay?","upi://pay?","UPI ID","Payee"])assert.ok(renter.includes(token),token);
 assert.match(renter,/create_rent_payment_submission/);
});
test("Renter must attach a supported screenshot, with preview/removal and optional UTR",()=>{
 assert.match(renter,/name="proof" type="file"[^>]*required/);
 assert.match(renter,/gdrPaymentProofPreview/);
 assert.match(renter,/name="utr" maxlength="30" placeholder="6–30 character reference if available"/);
 assert.match(renter,/createSignedUrl\(payments\[i\]\.proof_path,3600\)/);
 assert.match(renter,/p_payment_date:paymentDate/);
 assert.match(renter,/p_payment_method:app/);
});
test("Owner can securely view proof and must enter a reason when rejecting",()=>{
 assert.match(owner,/createSignedUrl\(p\.proof_path,3600\)/);
 assert.match(owner,/View payment screenshot/);
 assert.match(owner,/Reason for rejection \(required\)/);
});
