class HandKinematics {
    static _builders = {};

    constructor(hand_id) {
        this.hand_id = hand_id;
        if (!(hand_id in HandKinematics._builders)) {
            throw new Error(`Unsupported hand_id: ${hand_id}`);
        }
        const { M_thumb, Slist_thumb, Limit_thumb, Initial_thumb,
                M_index, Slist_index, Limit_index, Initial_index,
                M_middle, Slist_middle, Limit_middle, Initial_middle
         } = HandKinematics._builders[hand_id]();
        this.M_thumb = M_thumb;
        this.Slist_thumb = Slist_thumb;
        this.Limit_thumb = Limit_thumb;
        this.Initial_thumb = Initial_thumb;

        this.M_index = M_index;
        this.Slist_index = Slist_index;
        this.Limit_index = Limit_index;
        this.Initial_index = Initial_index;

        this.M_middle = M_middle;
        this.Slist_middle = Slist_middle;
        this.Limit_middle = Limit_middle;
        this.Initial_middle = Initial_middle;
    }

    static register_hand(hand_id, builderFunc) {
        HandKinematics._builders[hand_id] = builderFunc;
    }

    get_M_thumb() { 
        return this.M_thumb;
    }
    get_Slist_thumb() {
        return this.Slist_thumb;
    }
    get_Limit_thumb() {
        return this.Limit_thumb;
    }
    get_Initial_thumb() {
        return this.Initial_thumb;
    }

    get_M_index() {
        return this.M_index;
    }
    get_Slist_index() {
        return this.Slist_index;
    }
    get_Limit_index() {
        return this.Limit_index;
    }
    get_Initial_index() {
        return this.Initial_index;
    }

    get_M_middle() {
        return this.M_middle;
    }
    get_Slist_middle() {
        return this.Slist_middle;
    }
    get_Limit_middle() {
        return this.Limit_middle;
    }
    get_Initial_middle() {
        return this.Initial_middle;
    }
}

HandKinematics.register_hand("right", () => {
    const M_middle = [[0, 0, 1, 0.033], [0, 1, 0, -0.0025], [-1, 0, 0, 0.0193], [0, 0, 0, 1]];
    const Slist_thumb = [[0, 0, 1, 0], [0, 1, 0, -0.0255], [-1, 0, 0, -0.0193]];
    const Limit_thumb = [[-30 * Math.PI / 180, 30 * Math.PI / 180], [-17 * Math.PI / 180, 17 * Math.PI / 180], [-42 * Math.PI / 180, 42 * Math.PI / 180]];
    const Initial_thumb = [0, 0, 0];

    return { 
        M_thumb, Slist_thumb, Limit_thumb, Initial_thumb,
        M_index: null, Slist_index: null, Limit_index: null, Initial_index: null,
        M_middle: null, Slist_middle: null, Limit_middle: null, Initial_middle: null
     };
});