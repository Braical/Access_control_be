export default class AccessControlEvent {
   
    id = '';
	name = '';
	lote = '';
	UF = '';
    category_id = '';
    event_type = '';
    id_barrio = process.env.ID_BARRIO;
    picture = '';
    
    constructor(id, name, lote, uf, event_type, category_id) {
        this.id = id;
        this.name = name;
        this.lote = lote;
        this.UF = uf;
        this.category_id = category_id;
        this.event_type = event_type;
    }

    setPicture(newPicture){
        this.picture = newPicture;
    }  

};
