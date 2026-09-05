package visibility

type SetVisibilityRequest struct {
	ItemName string `json:"item_name"`
	Hidden   bool   `json:"hidden"`
}
