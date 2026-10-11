const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function env(){const calls=[],s={console};vm.createContext(s);vm.runInContext(fs.readFileSync(__dirname+'/Core.gs','utf8')+'\n'+fs.readFileSync(__dirname+'/Code.gs','utf8'),s);s.save_=r=>calls.push(['save',JSON.parse(JSON.stringify(r))]);s.records_=()=>[];s.blocked_=()=>false;s.block_=()=>{};s.policyCheck_=()=>{};s.api_=(...args)=>{calls.push(['api',...args]);return {};};s.DriveApp={Permission:{NONE:'NONE'},getFileById:id=>({getAccess:()=>{calls.push(['access',id]);return 'NONE';}})};s.MailApp={getRemainingDailyQuota:()=>100,sendEmail:a=>calls.push(['mail',a])};return {s,calls};}
const c={mode:'LIVE',policyReady:true,liveSince:1,notify:true,termsVersion:'v1',termsUrl:'https://example.org/terms'};
const rec=()=>({id:'new',email:'r@example.org',created:2,mode:'LIVE',termsVersion:'v1',review:'ELIGIBLE',permission:'NONE',notification:'NONE',attempts:0,nextAttempt:0});
test('adapter only targets fixed ZIP, user/reader, no native notification',()=>{const {s,calls}=env();s.process_(rec(),c);const request=calls.find(x=>x[0]==='api');assert.equal(request[1],'https://www.googleapis.com/drive/v3/files/1gy-sYSPqZZ_yMpRZ_ciyWj58GbsVeiwe/permissions?sendNotificationEmail=false');assert.deepEqual(JSON.parse(JSON.stringify(request[3])),{type:'user',role:'reader',emailAddress:'r@example.org'});assert.equal(calls.filter(x=>x[0]==='mail').length,1);});
test('cross-record prior attempt stops later queued application',()=>{const {s,calls}=env();s.records_=()=>[{record:{...rec(),id:'old',permission:'ATTEMPTING'}}];const r=rec();s.process_(r,c);assert.equal(r.review,'DUPLICATE_REVIEW');assert.equal(calls.filter(x=>x[0]==='api'||x[0]==='mail').length,0);});
test('adapter dry-run and date cutoff cannot grant or email',()=>{for(const cfg of [{...c,mode:'DRY_RUN'},{...c,liveSince:3}]){const {s,calls}=env();s.process_(rec(),cfg);assert.equal(calls.filter(x=>x[0]==='api'||x[0]==='mail').length,0);}});
test('adapter leaves non-retryable authorization failure for operator',()=>{const {s,calls}=env();s.api_=()=>{throw Error('HTTP 403 appNotAuthorizedToFile');};const r=rec();assert.throws(()=>s.process_(r,c));assert.equal(r.permission,'NEEDS_OPERATOR');assert.equal(calls.filter(x=>x[0]==='mail').length,0);});
function schemaEnv(){const {s,calls}=env();const fields={name:'Full name',institution:'Institution',identity:'Role / identity',purpose:'Research project and purpose',academic:'Academic research?',commercial:'Commercial use?',redistribution:'Redistribute original data or copies?',consent:'Dataset terms'};const cfg={formId:'form',sheetId:'sheet',ownerEmail:'owner@example.org',items:{}};const items=Object.keys(fields).map((key,i)=>{cfg.items[key]=String(i);const choice=['academic','commercial','redistribution','consent'].includes(key);return {getId:()=>i,getTitle:()=>fields[key],getType:()=>choice?'MULTIPLE_CHOICE':'PARAGRAPH_TEXT',isRequired:()=>true,asMultipleChoiceItem(){return this;},asParagraphTextItem(){return this;},getChoices:()=> (key==='consent'?['I agree','I do not agree']:['Yes','No','Unsure']).map(v=>({getValue:()=>v})),hasOtherOption:()=>false};});s.Session={getEffectiveUser:()=>({getEmail:()=>cfg.ownerEmail})};s.DriveApp.getFileById=()=>({getOwner:()=>({getEmail:()=>cfg.ownerEmail})});s.FormApp={openById:()=>({getItems:()=>items,isPublishingSummary:()=>false,getEditors:()=>[],canEditResponse:()=>false})};s.api_=()=>({settings:{emailCollectionType:'VERIFIED'}});s.privateLog_=()=>{};return {s,cfg,items};}
test('schema accepts intended form',()=>{const {s,cfg}=schemaEnv();assert.doesNotThrow(()=>s.schema_(cfg));});
test('schema refuses hand-entered or absent email collection',()=>{for(const mode of ['RESPONDER_INPUT','DO_NOT_COLLECT',undefined]){const {s,cfg}=schemaEnv();s.api_=()=>({settings:{emailCollectionType:mode}});assert.throws(()=>s.schema_(cfg));}});
test('schema refuses changed title/type/required/options/other',()=>{for(const mutate of [i=>i.getTitle=()=> 'Not academic?',i=>i.getType=()=> 'TEXT',i=>i.isRequired=()=>false,i=>i.getChoices=()=>[{getValue:()=> 'Yes'}],i=>i.hasOtherOption=()=>true]){const {s,cfg,items}=schemaEnv();mutate(items[4]);assert.throws(()=>s.schema_(cfg));}});
test('lock released even on an exception',()=>{const {s}=env();const events=[];s.LockService={getScriptLock:()=>({waitLock:n=>events.push(['wait',n]),releaseLock:()=>events.push(['release'])})};assert.throws(()=>s.locked_(()=>{throw Error('test');}));assert.deepEqual(events,[['wait',20000],['release']]);});

function configEnv(){
  const {cfg,items}=schemaEnv(), s={}, events=[];
  vm.createContext(s);vm.runInContext(fs.readFileSync(__dirname+'/Core.gs','utf8')+'\n'+fs.readFileSync(__dirname+'/Code.gs','utf8'),s);
  const owner='owner@example.org',user=email=>({getEmail:()=>email});
  const state={owner,effective:owner,editors:[owner],summary:false,helpText:'',description:''};
  const previous={...cfg,mode:'LIVE',policyReady:true,notify:true,liveSince:123,termsVersion:'old',termsUrl:'https://example.org/old'};
  const properties=new Map(Object.entries({CONFIG:JSON.stringify(previous),ENABLE_CONFIRMATION:'ENABLE 1gy-sYSPqZZ_yMpRZ_ciyWj58GbsVeiwe',
    APPROVED_TERMS_VERSION:'v2',APPROVED_TERMS_URL:'https://example.org/v2',APPROVED_OWNER_EMAIL:owner,APPROVED_PRIVACY_NOTICE:'Approved privacy notice'}));
  const saved=()=>JSON.parse(properties.get('CONFIG'));
  const storage={
    getProperty:key=>{if(state.fail==='approvedRead'&&key.startsWith('APPROVED_'))throw Error('approvedRead failed');return properties.get(key)||null;},
    setProperty:(key,value)=>{const parsed=JSON.parse(value);if(state.fail==='initialSave'||(state.fail==='finalSave'&&parsed.policyReady))throw Error('save failed');
      properties.set(key,value);events.push(['saveConfig',parsed]);},
    deleteProperty:key=>properties.delete(key)
  };
  s.props_=()=>storage;
  s.LockService={getScriptLock:()=>({waitLock:()=>{},releaseLock:()=>events.push(['unlock'])})};
  const mutation=(key,value)=>{events.push([key,saved()]);if(state.fail===key)throw Error(key+' failed');state[key]=value;};
  items[7].setHelpText=value=>mutation('helpText',value);items[7].getHelpText=()=>state.helpText;
  const form={getItems:()=>items,isPublishingSummary:()=>state.summary,getEditors:()=>state.editors.map(email=>email===null?null:user(email)),
    canEditResponse:()=>false,setAcceptingResponses:value=>mutation('close',value),setDescription:value=>mutation('description',value)};
  s.FormApp={openById:()=>{if(state.fail==='open')throw Error('open failed');return form;}};
  s.Session={getEffectiveUser:()=>user(state.effective)};
  s.DriveApp={Access:{PRIVATE:'PRIVATE'},getFileById:id=>{
    events.push(['file',id]);
    return id==='form'?{getOwner:()=>state.owner===null?null:user(state.owner)}:
      {getOwner:()=>user(owner),getName:()=>state.targetName||'dataset.zip',getSharingAccess:()=>state.targetSharing||'PRIVATE'};
  }};
  s.api_=(url,method)=>{
    if(method && method!=='get'){events.push(['forbidden','api']);throw Error('Unexpected API write');}
    events.push(['readApi',url]);
    if(url.includes('forms.googleapis.com'))return {settings:{emailCollectionType:state.emailMode||'VERIFIED'}};
    return {permissions:url.includes('/sheet/permissions')?(state.logPermissions||[{type:'user',role:'owner'}]):
      (state.targetPermissions||[{type:'user',role:'owner'}])};
  };
  const policyCheck=s.policyCheck_;
  s.policyCheck_=candidate=>{events.push(['validate',saved()]);return policyCheck(candidate);};
  s.ScriptApp={getProjectTriggers:()=>[{getHandlerFunction:()=> 'onApplicationSubmit'},{getHandlerFunction:()=> 'retryPending'}]};
  // Every external write fails the test, even if the production code catches its error.
  for(const name of ['MailApp','UrlFetchApp','SpreadsheetApp'])s[name]=new Proxy({}, {get:()=>{events.push(['forbidden',name]);throw Error('Unexpected external write');}});
  return {s,cfg,items,state,form,properties,saved,events};
}
function assertStopped(e){
  const c=e.saved();assert.equal(c.mode,'DRY_RUN');assert.equal(c.policyReady,false);assert.equal(c.notify,false);assert.equal(c.liveSince,0);
  assert.equal(e.properties.has('ENABLE_CONFIRMATION'),false);assert.equal(e.events.filter(x=>x[0]==='forbidden').length,0);
}
test('schema accepts owner included or omitted and still checks log ACL',()=>{
  for(const editors of [[],['owner@example.org'],[' OWNER@example.org ']]){
    const e=configEnv();e.state.editors=editors;assert.doesNotThrow(()=>e.s.schema_(e.cfg));
    assert(e.events.some(x=>x[0]==='readApi'&&x[1].includes('/sheet/permissions')));
  }
});
test('schema refuses foreign or unknown editor identities',()=>{
  for(const editors of [['other@example.org'],['owner@example.org','other@example.org'],[''],[undefined],[null]]){
    const e=configEnv();e.state.editors=editors;assert.throws(()=>e.s.schema_(e.cfg),/editors must be limited/);
  }
});
test('schema refuses empty, foreign or unknown owner and execution identity',()=>{
  for(const mutate of [e=>e.cfg.ownerEmail='',e=>e.cfg.ownerEmail='other@example.org',e=>e.state.owner=null,e=>e.state.owner='',
    e=>e.state.owner='other@example.org',e=>e.state.effective='',e=>e.state.effective='other@example.org']){
    const e=configEnv();mutate(e);assert.throws(()=>e.s.schema_(e.cfg),/configured executing account/);
  }
});
test('schema retains summary and log ACL checks',()=>{
  const a=configEnv();a.state.summary=true;assert.throws(()=>a.s.schema_(a.cfg),/summary must be disabled/);
  const b=configEnv();b.state.logPermissions=[{type:'user',role:'reader'}];assert.throws(()=>b.s.schema_(b.cfg),/owner-only/);
});
test('configuration checks owner before mutating the form',()=>{
  for(const mutate of [e=>e.state.owner='other@example.org',e=>e.state.owner=null,e=>e.state.effective='other@example.org',
    e=>e.properties.set('APPROVED_OWNER_EMAIL','other@example.org'),e=>e.state.editors=['owner@example.org','other@example.org']]){
    const e=configEnv();mutate(e);assert.throws(()=>e.s.configureApprovedTerms());assertStopped(e);
    assert.equal(e.events.filter(x=>['close','helpText','description'].includes(x[0])).length,0);
  }
});
test('configuration commits readiness last, closes intake and never restores LIVE',()=>{
  const e=configEnv();e.s.configureApprovedTerms();
  const writes=e.events.filter(x=>x[0]==='saveConfig').map(x=>x[1]);assert.equal(writes.length,2);
  assert.equal(writes[0].policyReady,false);assert.equal(writes[1].policyReady,true);
  for(const event of e.events.filter(x=>['close','helpText','description','validate'].includes(x[0]))){
    assert.equal(event[1].policyReady,false);assert.equal(event[1].mode,'DRY_RUN');assert.equal(event[1].notify,false);
  }
  const c=e.saved();assert.equal(c.mode,'DRY_RUN');assert.equal(c.notify,false);assert.equal(c.liveSince,0);
  assert.equal(c.termsVersion,'v2');assert.equal(c.termsUrl,'https://example.org/v2');assert.equal(c.ownerEmail,'owner@example.org');
  assert.equal(e.state.close,false);assert.equal(e.state.helpText,'Version: v2\nhttps://example.org/v2');
  assert.match(e.state.description,/Approved privacy notice/);assert.equal(e.properties.has('ENABLE_CONFIRMATION'),false);
  assert.equal(e.events.filter(x=>x[0]==='forbidden').length,0);
});
for(const fail of ['approvedRead','open','close','helpText','description','finalSave']){
  test('configuration remains stopped when '+fail+' fails',()=>{
    for(const mode of ['LIVE','DRY_RUN']){
      const e=configEnv(),old=e.saved();old.mode=mode;e.properties.set('CONFIG',JSON.stringify(old));e.state.fail=fail;
      assert.throws(()=>e.s.configureApprovedTerms());assertStopped(e);
      assert.equal(e.events.filter(x=>x[0]==='saveConfig'&&x[1].policyReady).length,0);
    }
  });
}
test('missing approved fields stop old LIVE before failing',()=>{
  for(const key of ['APPROVED_TERMS_VERSION','APPROVED_TERMS_URL','APPROVED_OWNER_EMAIL','APPROVED_PRIVACY_NOTICE']){
    const e=configEnv();e.properties.delete(key);assert.throws(()=>e.s.configureApprovedTerms(),/missing/);assertStopped(e);
  }
});
test('failed ZIP, schema or log checks never persist readiness',()=>{
  for(const mutate of [e=>e.state.targetName='not-zip.txt',e=>e.state.targetSharing='ANYONE',
    e=>e.state.targetPermissions=[{type:'anyone',role:'reader'}],e=>e.state.emailMode='RESPONDER_INPUT',
    e=>e.state.summary=true,e=>e.items[0].getTitle=()=> 'Changed',e=>e.state.logPermissions=[{type:'user',role:'reader'}]]){
    const e=configEnv();mutate(e);assert.throws(()=>e.s.configureApprovedTerms());assertStopped(e);
    assert.equal(e.events.filter(x=>x[0]==='saveConfig'&&x[1].policyReady).length,0);
  }
});
test('initial persistence failure stops before form changes without falsely claiming pause',()=>{
  const e=configEnv();e.state.fail='initialSave';assert.throws(()=>e.s.configureApprovedTerms(),/save failed/);
  assert.equal(e.events.filter(x=>['file','close','helpText','description','readApi'].includes(x[0])).length,0);
  assert.equal(e.saved().mode,'LIVE');
});
test('failed configuration cannot enable LIVE or process old pending grants',()=>{
  const e=configEnv();e.state.fail='description';assert.throws(()=>e.s.configureApprovedTerms());assertStopped(e);
  assert.throws(()=>e.s.enableLive(),/Owner-approved/);assert.doesNotThrow(()=>e.s.retryPending());
  // process_ reads existing records before its policy gate; supply only an empty private fixture.
  e.s.records_=()=>[];assert.throws(()=>e.s.process_(rec(),e.saved()),/Owner-approved/);assertStopped(e);
});
