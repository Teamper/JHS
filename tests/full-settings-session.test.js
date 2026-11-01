import { describe, it, expect } from "vitest";
import { SettingsService } from "../src/services/settings-service.js";
import { FullSettingsSession } from "../src/ui/settings/full-settings-session.js";
async function setup() { let stored = {themeMode:"light", containerColumns:5, hoverBigImg:"no"}; let writes=0; const service=new SettingsService({get:async()=>structuredClone(stored),set:async(_key,value)=>{writes++;stored=structuredClone(value)}});await service.load(); return {service,session:new FullSettingsSession(service),writes:()=>writes}; }
describe("full settings draft isolation",()=>{
 it("does not persist or publish to real settings before save",async()=>{const {session,service,writes}=await setup();await session.set("themeMode","dark");await session.update(d=>{d.customMagnetSources=JSON.stringify([{id:"fixture"}])});expect(writes()).toBe(0);expect(service.snapshot().themeMode).toBe("light");expect(session.dirtyKeys()).toEqual(["themeMode","customMagnetSources"]);session.dispose()});
 it("merges external clean fields while keeping edits; commits only captured values",async()=>{const {session,service}=await setup();await session.set("themeMode","dark");await service.patch({themeMode:"auto",containerColumns:8});expect(session.snapshot()).toMatchObject({themeMode:"dark",containerColumns:8});const submission=session.capture();await session.set("themeMode","light");await service.patch(submission);session.commit(submission);expect(session.snapshot().themeMode).toBe("light");expect(session.dirtyKeys()).toEqual(["themeMode"]);session.dispose()});
 it("clears reverted edits and drops disposed writes",async()=>{const {session,service,writes}=await setup();await session.set("hoverBigImg","yes");await session.set("hoverBigImg","no");expect(session.dirtyKeys()).toEqual([]);session.dispose();await session.set("themeMode","dark");expect(writes()).toBe(0);expect(service.snapshot().themeMode).toBe("light")});
 it("deep clones collections so nested editing cannot mutate committed settings",async()=>{const {session,service}=await setup();await service.set("detailShortcuts",{favorite:{key:"f"}});const view=session.snapshot();view.detailShortcuts.favorite.key="g";expect(service.snapshot().detailShortcuts.favorite.key).toBe("f");expect(session.snapshot().detailShortcuts.favorite.key).toBe("f");session.dispose()});
});

it("treats displayed defaults as the original value without persisting them", async () => {
 const {service,writes}=await setup(); const session=new FullSettingsSession(service,{enable115Match:false});
 await session.set("enable115Match",true); expect(session.dirtyKeys()).toEqual(["enable115Match"]);
 await session.set("enable115Match",false); expect(session.dirtyKeys()).toEqual([]); expect(writes()).toBe(0);
 await service.set("containerColumns",7); expect(session.snapshot().enable115Match).toBe(false); session.dispose();
});

it("does not count toggling built-in sources off and back to their default",async()=>{
 const {service,writes}=await setup(); const session=new FullSettingsSession(service,{magnetBuiltInSources:"[]"},{magnetBuiltInSources:[{id:"fixture",enabled:true,priority:10}]});
 await session.set("magnetBuiltInSources",JSON.stringify([{id:"fixture",enabled:false}])); expect(session.dirtyKeys()).toEqual(["magnetBuiltInSources"]);
 await session.set("magnetBuiltInSources",JSON.stringify([{id:"fixture",enabled:true}])); expect(session.dirtyKeys()).toEqual([]); expect(writes()).toBe(0); session.dispose();
});
